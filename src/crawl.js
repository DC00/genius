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

let scrape = async () => {
  const browser = await puppeteer.launch({headless : false})
  const page = await browser.newPage()
  var data

  for (var i = 1; i < config.max_page; i++) {
    console.log(config.genius_url + i)
    await page.goto(config.genius_url + i)
    let html = await page.content()
    let $ = cheerio.load(html)
    data = $('.badge_container').map(function(inx, badge) {
      var name = $(badge).find('[data-id]').text().trim()
      var iq = $(badge).find('.iq').text().trim()
      var url = $(badge).find('a').attr('href')
      // follow url to get followers and annotations
      return {name, iq, url}
    }).get()
  }

  await browser.close()
  return data

}

let fanotations = async (data) => {
  const browser = await puppeteer.launch({headless : false})
  const page = await browser.newPage()
  // forEach lets you mutate as you iterate, map() returns a new array
  data.forEach(function(json) {
    await page.goto(config.genius_root + json.url)

  })
}

// scrape() is async, returns Promise. resolved promise sends data to getFanotations
/*
scrape().then((data) => {
  await getFanotations(data)
})
*/

scrape().then(getFanotations(data))
