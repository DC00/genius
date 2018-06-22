/*
 * Genius.com scraper
 * Artist name, Genius iq, followers, and annotation count
 */

const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const mongoose = require('mongoose')
const Promise = require('bluebird')
const Artist = require('./artist.js')
var config = require('./config.json')

async function scrollToBottom(page, prevHeight) {
  console.log("in scroll to bottom")
  const pageHeight = await page.evaluate('document.body.scrollHeight')
  if (prevHeight < pageHeight)
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  return pageHeight
}

async function getAnnotations(page) {
  console.log("in get annotations")
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
async function scrape() {
  process.setMaxListeners(100)
  const browser = await puppeteer.launch({
    headless : true
  })
  const page = await browser.newPage()
  let data = []

  /*
  await page.goto(config.genius_root + '/Eminem', {waitUntil: "networkidle2"})
  await page.click(config.total_contributions_sel)
  await page.click(config.annotations_sel)
  var annotations = await scrapeInfiniteScroll(page, getAnnotations, 1000)
  console.log("total annotation count --> " + annotations)
  */

  for (var i = 2; i < config.max_page; i++) {
    await page.goto(config.verified_artists_url + i)
    const html = await page.content()
    const $ = cheerio.load(html)

    data = await Promise.all($('.badge_container').map(async function(inx, badge) {
      const name = $(badge).find('[data-id]').text().trim()
      const iq = $(badge).find('.iq').text().trim()
      const url = $(badge).find('a').attr('href')
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

      console.log("returning data")
      return {name, iq, url, followers, annotations}
    }).get())
  }

  await browser.close()
  return data
}

scrape()
  .then(data => { console.log(data) })
  .catch(err => { console.log(err) })
