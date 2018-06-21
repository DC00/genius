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

function getAnnotations() {
  
}

async scrapeInfiniteScroll(page, getAnnotations, count, delay) {
  // select annotations
  await page.click('body > routable-page > ng-outlet > routable-profile-page > ng-outlet > routed-page > profile-page > div.column_layout > div.column_layout-column_span.column_layout-column_span--primary > div > div > div > select-dropdown > span')
  await page.click('body > routable-page > ng-outlet > routable-profile-page > ng-outlet > routed-page > profile-page > div.column_layout > div.column_layout-column_span.column_layout-column_span--primary > div > div > div > select-dropdown > div > div:nth-child(2)')



}
async function scrape() {
  process.setMaxListeners(100)
  const browser = await puppeteer.launch({
    headless : false
  })
  const page = await browser.newPage()
  var data

  await page.goto(config.genius_root + '/Eminem', {waitUntil: "networkidle2"})
  var annotations = await scrapeInfiniteScroll(page, getAnnotations, 1000, 1000)





  /*
  for (var i = 1; i < config.max_page; i++) {
    await page.goto(config.verified_artists_url + i)
    const html = await page.content()
    const $ = cheerio.load(html)

    data = await Promise.all($('.badge_container').map(async function(inx, badge) {
      const name = $(badge).find('[data-id]').text().trim()
      const iq = $(badge).find('.iq').text().trim()
      const url = $(badge).find('a').attr('href')
      await page.goto(config.genius_root + url)
      const followers = await page.evaluate((selector) => {
        console.log(document.getElementsByClassName(selector))
        return document.querySelector(selector).innerText
      }, config.follower_sel)

      var annotations = await scrapeInfiniteScroll(page, getAnnotations, maxCount, 1000)


      return {name, iq, url, followers}
    }).get())
  }
  */

  // await browser.close()
  return data
}

scrape()
  .then(data => { console.log(data) })
  .catch(err => { console.log(err) })
