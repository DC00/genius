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
  const pageHeight = await page.evaluate('document.body.scrollHeight')
  if (prevHeight < pageHeight) {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  }
  await page.waitFor(1000)
  return pageHeight
}

/*
 * Scrapes total number of annotations on an artist's profile page
 * Scrolls to bottom of page and counts number of annotation elements
 * Loops until total annotation count does not change after scroll load
 */
async function getAnnotations(page, url, delay) {
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

      if (attrs) {
        count++
      }

    } catch (err) {
      logger.error("errored on count=" + count + "for url=" + url)
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

  for (var i = config.start_page; i <= config.end_page; i++) {
    await page.goto(config.verified_artists_url + i)
    const html = await page.content()
    const $ = cheerio.load(html)

    data = await Promise.all($('.badge_container').map(async function(inx, badge) {
      const name = $(badge).find('[data-id]').text().trim()
      const iq = parseInt($(badge).find('.iq').text().replace(',', '').trim())
      const url = $(badge).find('a').attr('href')

      return {"name":name, "iq":iq, "url":url}
    }).get())

  }

  await page.close()
  await browser.close()
  return data
}

async function scrapeArtist(url) {
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()

  await page.goto(config.genius_root + url)
  const html = await page.content()
  const $ = cheerio.load(html)

  // const name = $(config.artistPageNameSel).text().trim()
  const iq = parseInt($(config.artistPageIqSel).text().replace(',', '').trim())
  const followers = $(config.followerSel).text().trim()

  // don't need to batch anything
  try {
    await page.click(config.total_contributions_sel)
    await page.click(config.annotations_sel)
    const annotations = await getAnnotations(page, url, 1000)
    const artist = {"iq": iq, "url": url, "followers": followers, "annotations": annotations }
    dbService.upsertOne(artist)
  } catch (err) {
    logger.error("err in fetchAnnotations in scrapeArtist")
  }

  await page.close()
  await browser.close()

}

// https://www.jacoduplessis.co.za/async-js-batching/
function forEachPromise(items, fn) {
  return items.reduce((promise, item) => promise.then(() => fn(item)), Promise.resolve())
}


scrapeArtist("/johnnypolygon")
.then(() => { console.log("done scrape artist") })
.catch((err) => { console.log("error in scrape artist") })

