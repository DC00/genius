/*
 * Genius.com scraper
 * Artist name, Genius iq, followers, and annotation count
 */

const puppeteer = require('puppeteer') 
const cheerio = require('cheerio')
const mongoose = require('mongoose')
const Promise = require('bluebird')
const Artist = require('./artist.js')
const config = require('./config.json')

async function scrollToBottom(page, prevHeight) {
  const pageHeight = await page.evaluate('document.body.scrollHeight')
  if (prevHeight < pageHeight)
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await page.waitFor(1000)
  return pageHeight
}

async function getAnnotations(page) {
  const html = await page.content()
  const $ = cheerio.load(html)
  await page.waitFor(1000)
  const annotations = $('.standalone_annotation-annotation').length
  return annotations
}


async function scrapeInfiniteScroll(page, getAnnotations, delay) {
  // better scraping method?
  /*
   * Increments of 8
   * not really infinite, end condition is (total) % 8 != 0
   * How to test if last page is multiple of 8
   * Can use xpath nth child string instead of cheerio to decrease compute time
   * keep track of total and if total does not change after 1 iteration stop
   */

  let prevHeight = -1
  let count = 1
  // try/catch works with synch and async/await code
  try {
    const currentCount = page.evaluate(() => {
      return document.querySelector(config.annotation_card.replace("##", count))
    })
    console.log(currentCount)
    count++
    await scrollToBottom(page, prevHeight)
    await page.waitFor(delay)
  } catch (err) {
    console.log(err)
  }









  /*
  let prevAnnotationCount = -9
  let annotationCount = await getAnnotations(page)
  let prevHeight = -1
  */

  /*
  while (prevAnnotationCount <= (annotationCount - 8)) {
    prevAnnotationCount = annotationCount
    prevHeight = await scrollToBottom(page, prevHeight)
    await page.waitFor(delay)
    annotationCount = await getAnnotations(page)
  }
  */

  // return annotationCount
}

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


async function scrape() {
  const browser = await puppeteer.launch({
    headless : true
  })
  const page = await browser.newPage()
  const artistPage = await browser.newPage()
  let data = []

  /*
  await page.goto(config.genius_root + '/Eminem', {waitUntil: "networkidle2"})
  await page.click(config.total_contributions_sel)
  await page.click(config.annotations_sel)
  var annotations = await scrapeInfiniteScroll(page, getAnnotations, 2000)
  console.log("total annotation count --> " + annotations)
  */

  for (var i = 1; i < config.max_page; i++) {
    await page.goto(config.verified_artists_url + i)
    const html = await page.content()
    const $ = cheerio.load(html)

    data = await Promise.all($('.badge_container').map(async function(inx, badge) {
      const name = $(badge).find('[data-id]').text().trim()
      const iq = $(badge).find('.iq').text().trim()
      const url = $(badge).find('a').attr('href')

      /*
      await page.goto(config.genius_root + url, {waitUntil: "networkidle2"})
      const followers = await page.evaluate((selector) => {
        console.log(document.getElementsByClassName(selector))
        return document.querySelector(selector).innerText
      }, config.follower_sel)

      try {
        await page.click(config.total_contributions_sel, {
          button : "left",
          clickCount : 1,
          delay : 50
        })
        await page.click(config.annotations_sel, {
          button : "left",
          clickCount : 1,
          delay : 50
        })
      } catch (err) {
        console.log("wtf click" + err)
      }
      console.log("calling get annotations")
      const annotations = await scrapeInfiniteScroll(page, getAnnotations, 1000)
      */

      return {"name":name, "iq":iq, "url":url}
    }).get())
  }

  await page.close()
  await browser.close()
  return data
}

function forEachPromise(items, fn) {
  return items.reduce((promise, item) => promise.then(() => fn(item)), Promise.resolve())
}



scrape()
  .then(async data => {
    const browser = await puppeteer.launch({headless: false})
    const batchSize = 5
    const annotationBatchSize = 2
    const numArtists = Object.keys(data).length
    const numBatches = Math.ceil(numArtists / batchSize)
    const numAnnotationBatches = Math.ceil(numArtists / annotationBatchSize)
    const indicies = Array(numBatches).fill(0).map((e, i) => i * batchSize)
    const annotationInx = Array(numAnnotationBatches).fill(0).map((e, i) => i * annotationBatchSize)
    const bad = []
    console.log(numArtists)
    console.log(indicies)
    console.log(annotationInx)

    async function getFollowers(batchStart) {
      console.log("New batch: " + batchStart)
      const batch = data.slice(batchStart, batchStart + batchSize)

      await Promise.all(batch.map(async d => {
        // followers
        const page = await browser.newPage()
        await page.goto(config.genius_root + d.url, { waitUntil : "networkidle2", timeout : 0 })
        d.followers = await page.evaluate((selector) => {
          return document.querySelector(selector).innerText
        }, config.follower_sel)



        console.log("Artist: " + d.name)
        console.log("Followers: " + d.followers)
        



        return page.close()
      }))
      return data
    }

    async function fetchAnnotations(start) {
      console.log("New annotation batch: " + start)
      const batch = data.slice(start, start + annotationBatchSize)

      await Promise.all(batch.map(async d => {
        const page = await browser.newPage()
        await page.goto(config.genius_root + d.url, { waitUntil : "networkidle2", timeout : 0 })
        try {
          await page.click(config.total_contributions_sel)
          await page.click(config.annotations_sel)
          d.annotations = await scrapeInfiniteScroll(page, getAnnotations, 1000)
        } catch (err) {
          bad.push(d.url)
          console.log(err)
        }

        console.log("Artist: " + d.name)
        console.log("Annotations: " + d.annotations)
      
        return page.close()
      }))

      return data
    }

    await forEachPromise(annotationInx, fetchAnnotations)
    await forEachPromise(indicies, getFollowers)

    console.log("bad")
    console.log(bad)
    console.log("good")
    console.log(data)

  
  })
  .catch(err => { console.log(err) })
