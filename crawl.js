/*
 * Genius.com scraper
 * Artist name, Genius iq, followers, and annotation count
 */

const puppeteer = require('puppeteer') 
const cheerio = require('cheerio')
const config = require('./config.json')
const dbService = require('./mongoService')

async function scrollToBottom(page, prevHeight) {
  const pageHeight = await page.evaluate('document.body.scrollHeight')
  if (prevHeight < pageHeight)
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await page.waitFor(1000)
  return pageHeight
}

/*
async function getAnnotations(page) {
  const html = await page.content()
  const $ = cheerio.load(html)
  await page.waitFor(1000)
  const annotations = $('.standalone_annotation-annotation').length
  return annotations
}
*/


/*
 * Scrapes total number of annotations on an artist's profile page
 * Scrolls to bottom of page and counts number of annotation elements
 * Loops until total annotation count does not change after scroll load
 */
async function scrapeInfiniteScroll(page, delay) {
  // better scraping method?
  /*
   * Increments of 8
   * not really infinite, end condition is (total) % 8 != 0
   * How to test if last page is multiple of 8
   * Can use xpath nth child string instead of cheerio to decrease compute time
   * keep track of total and if total does not change after 1 iteration stop
   */


  /*
   * test if has > 8 annotations with cheerio
   * if true, then use annotation_card
   * else, return count
   */
  
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
    console.log("returning <=8")
    return annotations
  }

  let count = 1
  let currentCount = 8
  let prevHeight = -1
  let attrs = []

  // stop if count does not change after page scroll
  while (attrs) {
    try {
      console.log("count=" + count)
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
      console.log("errored on count=" + count)
      console.log(err)
    }
  }

  return count - 1
  



  /*
  let prevAnnotationCount = -9
  let annotationCount = await getAnnotations(page)
  let prevHeight = -1

  while (prevAnnotationCount <= (annotationCount - 8)) {
    prevAnnotationCount = annotationCount
    prevHeight = await scrollToBottom(page, prevHeight)
    await page.waitFor(delay)
    annotationCount = await getAnnotations(page)
    console.log("annotations: " + annotationCount)
  }

  return annotationCount
  */
}

/*
async function scrapeArtistPage(data, artistPage) {
  let annotationCount = 0
  await artistPage.goto(config.genius_root + data.url, {waitUntil: "networkidle2"})

  let prevAnnotationCount = -9
  let prevHeight = -1
  annotationCount = await getAnnotations(artistPage)

  while (prevAnnotationCount <= (annotationCount - 8)) {
    prevAnnotationCount = annotationCount
    prevHeight = await scrollToBottom(artistPage, prevHeight)
    await artistPage.waitFor(1000)
    annotationCount = await getAnnotations(artistPage)
  }

  return annotationCount

}
*/


/* 
 * Gets name, iq, and url extension for each artist on /verified-artists?page=XX
 * Returns list of json elements [{ name: "abc", iq: 101, url: "/Eminem" }, ...]
 */
async function scrape() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  let data = []

  for (var i = 422; i < config.max_page; i++) {
    await page.goto(config.verified_artists_url + i)
    const html = await page.content()
    const $ = cheerio.load(html)

    data = await Promise.all($('.badge_container').map(async function(inx, badge) {
      const name = $(badge).find('[data-id]').text().trim()
      const iq = $(badge).find('.iq').text().trim()
      const url = $(badge).find('a').attr('href')

      return {"name":name, "iq":iq, "url":url}
    }).get())

  }

  await page.close()
  await browser.close()
  console.log("accessing data ###")
  console.log(data[0])
  console.log(data[0]["name"])
  return data
}

async function scrapeArtist(url) {
  const browser = await puppeteer.launch({ headless: false })
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

function upsert(data) {
  
}

scrape()
  .then(async data => {
    const browser = await puppeteer.launch({ headless: false })

    // data is not a json array for some reason
    const numArtists = Object.keys(data).length
    const numBatches = Math.ceil(numArtists / config.batchSize)
    const numAnnotationBatches = Math.ceil(numArtists / config.annotationBatchSize)

    const slicesToBatch = Array(numBatches).fill(0).map((e, i) => i * config.batchSize)
    const annotationSlicesToBatch = Array(numAnnotationBatches).fill(0).map((e, i) => i * config.annotationBatchSize)

    const bad = []
    console.log("Number of Artists: " + numArtists)
    console.log("Artists Slices: " + slicesToBatch)
    console.log("Annotation Slices: " + annotationSlicesToBatch)

    async function getFollowers(batchStart) {
      console.log("New batch: " + batchStart)
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

        console.log("Artist: " + d.name)
        console.log("Followers: " + d.followers)

        return page.close()
      }))
      return data
    }



    async function fetchAnnotations(start) {
      console.log("New annotation batch: " + start)
      const batch = data.slice(start, start + config.annotationBatchSize)

      await Promise.all(batch.map(async d => {
        const page = await browser.newPage()
        await page.goto(config.genius_root + d.url, { waitUntil : "networkidle2", timeout : 0 })
        try {
          await page.click(config.total_contributions_sel)
          await page.click(config.annotations_sel)
          d.annotations = await scrapeInfiniteScroll(page, 1000)
        } catch (err) {
          bad.push(d.url)
          console.log(err)
        }

        console.log("Artist: " + d.name)
        console.log("Annotations: " + d.annotations)

      
        return page.close()
      }))

      console.log("after scrape access ###")
      console.log(data[0])
      console.log(data[0].name)
      console.log(data[0].followers)
      
      dbService.upsert(data)       

      return data
    }

    await forEachPromise(annotationSlicesToBatch, fetchAnnotations)
    await forEachPromise(slicesToBatch, getFollowers)

    console.log("bad")
    console.log(bad)
    console.log("good")
    console.log(data)
  
  })
  .catch(err => { console.log(err) })
