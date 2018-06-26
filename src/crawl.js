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
  console.log("in scroll to bottom")
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
  console.log("in get annotations, length : " + annotations)
  return annotations
}


async function scrapeInfiniteScroll(page, getAnnotations, delay) {
  console.log("in inf scroll")
  let prevAnnotationCount = -9
  let annotationCount = await getAnnotations(page)
  let prevHeight = -1

  await scrollToBottom(page, prevHeight)

  while (prevAnnotationCount <= (annotationCount - 8)) {
    prevAnnotationCount = annotationCount
    prevHeight = await scrollToBottom(page, prevHeight)
    await page.waitFor(delay)
    annotationCount = await getAnnotations(page)
    console.log("annotation count: " + annotationCount)
  }

  return annotationCount
}

async function scrapeArtistPage(data, artistPage) {
  console.log("in scrape artist page")
  let annotationCount = 0
  console.log(config.genius_root + data.url)
  await artistPage.goto(config.genius_root + data.url, {waitUntil: "networkidle2"})

  let prevAnnotationCount = -9
  let prevHeight = -1
  annotationCount = await getAnnotations(artistPage)

  while (prevAnnotationCount <= (annotationCount - 8)) {
    prevAnnotationCount = annotationCount
    prevHeight = await scrollToBottom(artistPage, prevHeight)
    await artistPage.waitFor(1000)
    annotationCount = await getAnnotations(artistPage)
    console.log("annotation count: " + annotationCount)
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

  await browser.close()
  return data
}

function forEachPromise(items, fn) {
  return items.reduce((promise, item) => promise.then(() => fn(item)), Promise.resolve())
}

scrape()
  .then(async data => {
    const browser = await puppeteer.launch({headless: false})
    const page = await browser.newPage()
    await page.goto(config.genius_root + data[0].url, { waitUntil : "networkidle2" })
    const followers = await page.evaluate((selector) => {
      return document.querySelector(selector).innerText
    }, config.follower_sel)
    console.log(followers)

  
    await Promise.all(data.forEach(d => {
      return new Promise(async (resolve, reject) => {
        await page.goto(config.genius_root + d.url, { waitUntil : "networkidle2" }) 
        d.followers = await page.evaluate((selector) => {
          return document.querySelector(selector).innerText
        }, config.follower_sel)
        console.log(d.followers)
        await page.waitFor(1000)
      })
    }))



    /*
    const promises = []
    for (var i = 0; i < Object.keys(data).length-1; i++) {
      console.log("calling goto for " + config.genius_root + data[i].url)
      promises.push(browser.newPage().then(async page => {
        await page.goto(config.genius_root + data[i].url, { waitUntil : "networkidle2" })
        data[i]["followers"] = await page.evaluate((selector) => {
          return document.querySelector(selector).innerText
        }, config.follower_sel)
      }))
    }

    await Promise.all(promises)
    */

    // console.log(data)
  
  })
  .catch(err => { console.log(err) })
