/*
 * Genius.com scraper
 * Inserts verified artist data into mongodb instance
 */

const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const mongoose = require('mongoose')
const Promise = require('bluebird')
const Artist = require('./artist.js')
var config = require('./config.json')

async function scrape() {
  const browser = await puppeteer.launch({headless : false}).catch(err => { console.log(err) })
  const page = await browser.newPage().catch(err => { console.log(err) })
  var data

  /*
  await page.goto(config.genius_root + "/Eminem").catch(err => { console.log(err) })
  let html = await page.content().catch(err => { console.log(err) })
  let $ = cheerio.load(html)
  console.log($('.profile_tabs-tab-count').text())
  */

  for (var i = 1; i < config.max_page; i++) {
    console.log(config.genius_url + i)
    await page.goto(config.genius_url + i).catch(err => { console.log(err) })
    let html = await page.content().catch(err => { console.log(err) })
    let $ = cheerio.load(html)
    data = $('.badge_container').map(async function(inx, badge) {
      var name = $(badge).find('[data-id]').text().trim()
      var iq = $(badge).find('.iq').text().trim()
      var url = $(badge).find('a').attr('href')
      var followers = async function() {
        try {
          await artistPage.goto(config.genius_root + url, { waitUntil: "load" }).catch(err => { console.log(err) })
          let html2 = await artistPage.content().catch(err => { console.log(err) })
          let $ = await cheerio.load(html2)
          var f = $('.profile_tabs-tab-count').text()
          return f

        } catch (e) {
          console.log(e)
        }
        /* let artistPage = await browser.newPage()
        await artistPage.goto(config.genius_root + url, { waitUntil: "load" }).catch(err => { console.log(err) })
        let html2 = await artistPage.content().catch(err => { console.log(err) })
        let $ = await cheerio.load(html2)
        var f = $('.profile_tabs-tab-count').text()
        */
      }
      return {name, iq, url, followers}
    }).get()
  }

  await browser.close().catch(err => { console.log(err) })
  return data
}

// scrape() is async, returns Promise
scrape()
  .then(data => { console.log(data) })
  .catch(err => { console.log(err) })





