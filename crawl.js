/*
 * Genius.com scraper
 * Artist name, Genius iq, followers, and annotation count
 */

const puppeteer = require('puppeteer') 
const cheerio = require('cheerio')
const config = require('./config.json')
const dbService = require('./mongoService')
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;
const logger = createLogger({
  format: combine(
    format.colorize(),
    format.simple()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'server.log' })
  ]
});

async function scrollToBottom(page, prevHeight) {
  logger.info("waiting for scroll height")
  const pageHeight = await page.evaluate('document.body.scrollHeight')
  logger.info("after scroll height")
  if (prevHeight < pageHeight) {
    logger.info("waiting for scroll to bottom")
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    logger.info("after scroll to bottom")
  }
  logger.info("waiting for wait for")
  await page.waitFor(1000)
  logger.info("after wait for")
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
  logger.info("waiting for delay")
  await page.waitFor(delay)
  logger.info("after wait for delay")
  logger.info("waiting for scroll to bottom 2")
  await scrollToBottom(page, 0)
  logger.info("after scroll to bottom 2")
  logger.info("waiting for wait for 2")
  await page.waitFor(delay)
  logger.info("after for wait for 2")
  const html = await page.content()
  const $ = cheerio.load(html)
  logger.info("waiting for wait for delay 3")
  await page.waitFor(delay)
  logger.info("after for wait for delay 3")
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
      logger.info("waiting for annotation sel")
      attrs = await page.evaluate((sel) => {
        return document.querySelector(sel)
      }, config.annotation_card_more.replace("##", count))
      logger.info("after annotation sel")
      
      if (count % 8 == 0) {
        logger.info("waiting for scroll to bottom 4")
        prevHeight = await scrollToBottom(page, prevHeight)
        logger.info("after for scroll to bottom 4")
        logger.info("waiting for delay 3?")
        await page.waitFor(delay)
        logger.info("after for delay 3?")
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
  logger.info("waiting A")
  const browser = await puppeteer.launch({ headless: true })
  logger.info("after A")
  logger.info("waiting B")
  const page = await browser.newPage()
  logger.info("after B")
  let data = []
  logger.info("### scrape ###")

  for (var i = config.start_page; i <= config.end_page; i++) {
    logger.info("waiting C")
    await page.goto(config.verified_artists_url + i)
    logger.info("after C")
    logger.info("waiting D")
    const html = await page.content()
    logger.info("after D")
    const $ = cheerio.load(html)

    logger.info("waiting E")
    data = await Promise.all($('.badge_container').map(async function(inx, badge) {
      const name = $(badge).find('[data-id]').text().trim()
      const iq = parseInt($(badge).find('.iq').text().replace(',', '').trim())
      const url = $(badge).find('a').attr('href')

      logger.info(name + " " + iq + " " + url)
      logger.info("resolving E")
      return {"name":name, "iq":iq, "url":url}
    }).get())
    logger.info("after E")

    logger.info("page=" + i)
  }

  logger.info("waiting F")
  await page.close()
  logger.info("after F")
  logger.info("waiting G")
  await browser.close()
  logger.info("after G")
  return data
}

async function scrapeArtist(url) {
  logger.info("### scrapeArtist ###")
  logger.info("waiting H")
  const browser = await puppeteer.launch({ headless: true })
  logger.info("after H")
  logger.info("waiting I")
  const page = await browser.newPage()
  logger.info("after I")

  logger.info("waiting J")
  await page.goto(config.genius_root + url)
  logger.info("after J")
  logger.info("waiting K")
  const html = await page.content()
  logger.info("after K")
  const $ = cheerio.load(html)

  const name = $(config.artistPageNameSel).text().trim()
  logger.info("#### name: " + name)
  const iq = parseInt($(config.artistPageIqSel).text().replace(',', '').trim())
  logger.info("#### iq: " + iq)
  const followers = $(config.followerSel).text().trim()
  logger.info("#### followers: " + followers)

  logger.info("### fanotations in scrapeArtist ###")
  // don't need to batch anything
  try {
    await page.click(config.total_contributions_sel)
    await page.click(config.annotations_sel)
    const annotations = await getAnnotations(page, url, name, 1000) 
    logger.info("### annotations: " + annotations)

  } catch (err) {
    logger.error("err in fetchAnnotations in scrapeArtist")
  }



  logger.info("waiting L")
  await page.close()
  logger.info("after L")
  logger.info("waiting M")
  await browser.close()
  logger.info("after M")

  

  return { "name": name, "iq": iq, "url": url, "followers": followers }
}

// https://www.jacoduplessis.co.za/async-js-batching/
function forEachPromise(items, fn) {
  logger.info("in for each promise")
  return items.reduce((promise, item) => promise.then(() => fn(item)), Promise.resolve())
}

scrape()
  .then(async data => {
    logger.info("### fanotations ###")
    logger.info("waiting N")
    const browser = await puppeteer.launch({ headless: true })
    logger.info("after N")

    // data is not a json array for some reason
    const numArtists = Object.keys(data).length
    const numBatches = Math.ceil(numArtists / config.batchSize)
    const numAnnotationBatches = Math.ceil(numArtists / config.annotationBatchSize)

    const slicesToBatch = Array(numBatches).fill(0).map((e, i) => i * config.batchSize)
    const annotationSlicesToBatch = Array(numAnnotationBatches).fill(0).map((e, i) => i * config.annotationBatchSize)

    logger.info("Number of Artists: " + numArtists)
    logger.info("Artists Slices: " + slicesToBatch)
    logger.info("Annotation Slices: " + annotationSlicesToBatch)

    /*
    async function getFollowers(batchStart) {
      logger.info("### getFollowers ###")
      logger.info("New batch: " + batchStart)
      const batch = data.slice(batchStart, batchStart + config.batchSize)

       // Get followers on each artist page
       //  Returns { name: "abc", iq: 101, url: "/Eminem", followers: 236 }
      try {
        logger.info("waiting O")
        logger.info(batch)
        logger.info(batch[0])
        await Promise.all(batch.map(async d => {
          logger.info("waiting P")
          const page = await browser.newPage()
          logger.info("after P")
          logger.info("going to page " + config.genius_root + d.url)
          logger.info("waiting Q")
          await page.goto(config.genius_root + d.url, { waitUntil: "networkidle2", timeout: 0 })
          logger.info("after Q")
          logger.info("on the page")
          try {
            logger.info("waiting R")
            d.followers = await page.evaluate((selector) => {
              return document.querySelector(selector).innerText.replace(',','')
            }, config.followerSel)
            logger.info("after R")
          } catch (err) {
            logger.info("can't find sel for followers")
          }

          logger.info("Artist: " + d.name)
          logger.info("Followers: " + d.followers)

          await page.close()

          return d
        }))
        logger.info("after O")
      } catch (err) {
        logger.error("err in promise all follower count" + err)
      }

      return batch
    }
    */

    async function fetchAnnotations(start) {
      logger.info("### fetchAnnotations ###")
      logger.info("New annotation batch: " + start)
      const batch = data.slice(start, start + config.annotationBatchSize)

      try {
        logger.info("waiting S")
        await Promise.all(batch.map(async d => {
          logger.info("waiting T")
          const page = await browser.newPage()
          logger.info("after T")
          logger.info("waiting U")
          await page.goto(config.genius_root + d.url, { waitUntil : "networkidle2", timeout : 0 })
          logger.info("after U")
          logger.info("waiting V")
          await page.click(config.total_contributions_sel)
          logger.info("after V")
          logger.info("waiting W")
          await page.click(config.annotations_sel)
          logger.info("after W")
          logger.info("waiting X")
          d.followers = await page.evaluate((selector) => {
            return document.querySelector(selector).innerText.replace(',', '')
          }, config.followerSel)
          d.annotations = await getAnnotations(page, d.url, d.name, 1000)
          logger.info("after X")

          logger.info("Artist: " + d.name)
          logger.info("Annotations: " + d.annotations)

          logger.info("waiting Y")
          await page.close()
          logger.info("after Y")
        }))
        logger.info("after S")
      } catch (err) {
        logger.error("err in promise all fetchAnnotations " + err)
      }

      logger.info("waiting on upsert")
      dbService.upsert(batch)
      logger.info("after upsert")
      return batch
    }

    logger.info("waiting for fetch annotations")
    await forEachPromise(annotationSlicesToBatch, fetchAnnotations)
    logger.info("finished all fetch annotations")
    // logger.info("waiting for get followers")
    // await forEachPromise(slicesToBatch, getFollowers)
    // logger.info("finished all get Followers")
  })
  .then(() => { logger.info("############# Done! ##############") })
  .catch(err => { logger.error("########### ERROR ##############" + err) })
