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

async function scrape() {
  process.setMaxListeners(100);
  const browser = await puppeteer.launch({headless : false})
  const page = await browser.newPage()
  var data

  for (var i = 1; i < config.max_page; i++) {
    await page.goto(config.verified_artists_url + i)
    let html = await page.content()
    let $ = cheerio.load(html)

    data = await Promise.all($('.badge_container').map(async function(inx, badge) {
      var name = $(badge).find('[data-id]').text().trim()
      var iq = $(badge).find('.iq').text().trim()
      var url = $(badge).find('a').attr('href')
      await page.goto(config.genius_root + url)
      var followers = await page.evaluate((selector) => {
        console.log(document.getElementsByClassName(selector))
        return document.querySelector(selector).innerText
      }, config.follower_sel)

      // get annotations on same page
      // infinite scrolling bullshit

      return {name, iq, url, followers}
    }).get())
  }

  browser.close()
  return data
}

scrape()
  .then(data => { console.log(data) })
  .catch(err => { console.log(err) })
