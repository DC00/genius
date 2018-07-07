/*
 * Genius.com scraper
 * Artist name, Genius iq, followers, and annotation count
 */

const puppeteer = require('puppeteer') 
const cheerio = require('cheerio')
const config = require('./config.json')
const dbService = require('./mongoService')
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
const myFormat = printf(info => {
  return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
});
const logger = createLogger({
  format: combine(
    format.colorize(),
    myFormat
  ),
  transports: [
    new transports.Console({ format: format.simple() }),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'server.log' })
  ]
});

async function scrollToBottom(page, prevHeight) {
  const pageHeight = await page.evaluate('document.body.scrollHeight')
  if (prevHeight < pageHeight)
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await page.waitFor(1000)
  return pageHeight
}

/*
 * Scrapes total number of annotations on an artist's profile page
 * Scrolls to bottom of page and counts number of annotation elements
 * Loops until total annotation count does not change after scroll load
 */
async function getAnnotations(page, url, name, delay) {
  // find artists with more than 8 annotations, sort ascending
  // db.artists.aggregate( {$match: {annotations: {$gt: 8}}}, {$sort: {annotations: 1}} )
  await page.waitFor(delay)
  await scrollToBottom(page, 0)
  await page.waitFor(delay)
  const html = await page.content()
  const $ = cheerio.load(html)
  await page.waitFor(delay)
  const annotations = $('.standalone_annotation-annotation').length
  if (parseInt(annotations) <= 8) { 
    return annotations
  }

  let count = 1
  let currentCount = 8
  let prevHeight = -1
  let attrs = []

  // stop if count does not change after page scroll
  while (attrs) {
    try {
      attrs = await page.evaluate((sel) => {
        return document.querySelector(sel)
      }, config.annotation_card_more.replace("##", count))
      
      if (count % 8 == 0) {
        prevHeight = await scrollToBottom(page, prevHeight)
        await page.waitFor(delay)
      }

      logger.info(name + ":" + count)
      
      if (attrs) {
        count++
      }

    } catch (err) {
      logger.error("errored on count=" + count + "for artist=" + name + " url=" + url)
    }
  }

  return count - 1
}

/* 
 * Gets name, iq, and url extension for each artist on /verified-artists?page=XX
 * Returns list of json elements [{ name: "abc", iq: 101, url: "/Eminem" }, ...]
 */
async function scrape() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  let data = []
  logger.info("### scrape ###")

  for (var i = config.start_page; i <= config.end_page; i++) {
    await page.goto(config.verified_artists_url + i)
    const html = await page.content()
    const $ = cheerio.load(html)

    data = await Promise.all($('.badge_container').map(async function(inx, badge) {
      const name = $(badge).find('[data-id]').text().trim()
      const iq = parseInt($(badge).find('.iq').text().trim())
      const url = $(badge).find('a').attr('href')

      logger.info(name + " " + iq + " " + url)
      return {"name":name, "iq":iq, "url":url}
    }).get())
    logger.info("page=" + i)
  }

  await page.close()
  await browser.close()
  return data
}

async function scrapeArtist(url) {
  logger.info("### scrapeArtist ###")
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(config.genius_root + url)
  const html = await page.content()
  const $ = cheerio.load(html)

  const name = $(config.artistPageNameSel).text().trim()
  const iq = $(config.artistPageIqSel).text().trim()
  const followers = $(config.followerSel).text().trim()

  await page.close()
  await browser.close()

  return { "name": name, "iq": iq, "url": url, "followers": followers }
}

// https://www.jacoduplessis.co.za/async-js-batching/
function forEachPromise(items, fn) {
  return items.reduce((promise, item) => promise.then(() => fn(item)), Promise.resolve())
}

scrape()
  .then(async data => {
    logger.info("### fanotations ###")
    const browser = await puppeteer.launch({ headless: true })

    // data is not a json array for some reason
    const numArtists = Object.keys(data).length
    const numBatches = Math.ceil(numArtists / config.batchSize)
    const numAnnotationBatches = Math.ceil(numArtists / config.annotationBatchSize)

    const slicesToBatch = Array(numBatches).fill(0).map((e, i) => i * config.batchSize)
    const annotationSlicesToBatch = Array(numAnnotationBatches).fill(0).map((e, i) => i * config.annotationBatchSize)

    const bad = []
    logger.info("Number of Artists: " + numArtists)
    logger.info("Artists Slices: " + slicesToBatch)
    logger.info("Annotation Slices: " + annotationSlicesToBatch)

    async function getFollowers(batchStart) {
      logger.info("### getFollowers ###")
      logger.info("New batch: " + batchStart)
      const batch = data.slice(batchStart, batchStart + config.batchSize)

      /*
       * Get followers on each artist page
       * Returns { name: "abc", iq: 101, url: "/Eminem", followers: 236 }
       */
      await Promise.all(batch.map(async d => {
        const page = await browser.newPage()
        await page.goto(config.genius_root + d.url, { waitUntil: "networkidle2", timeout: 0 })
        d.followers = await page.evaluate((selector) => {
          return document.querySelector(selector).innerText
        }, config.followerSel)

        logger.info("Artist: " + d.name)
        logger.info("Followers: " + d.followers)

        return page.close()
      }))
      return data
    }

    async function fetchAnnotations(start) {
      logger.info("### fetchAnnotations ###")
      logger.info("New annotation batch: " + start)
      const batch = data.slice(start, start + config.annotationBatchSize)

      await Promise.all(batch.map(async d => {
        const page = await browser.newPage()
        await page.goto(config.genius_root + d.url, { waitUntil : "networkidle2", timeout : 0 })
        try {
          await page.click(config.total_contributions_sel)
          await page.click(config.annotations_sel)
          d.annotations = await getAnnotations(page, d.url, d.name, 1000)
        } catch (err) {
          logger.error(d)
        }

        logger.info("Artist: " + d.name)
        logger.info("Annotations: " + d.annotations)

      
        return page.close()
      }))

      dbService.upsert(data)       
      logger.info("Done with batch: " + start)
      return data
    }

    await forEachPromise(annotationSlicesToBatch, fetchAnnotations)
    await forEachPromise(slicesToBatch, getFollowers)

  })
  .then(() => { logger.info("############# Done! ##############") })
  .catch(err => { logger.error(err) })
