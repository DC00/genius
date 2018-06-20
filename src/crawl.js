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
  return 100
}

async function scrapeInfiniteScroll(page, getAnnotations, maxCount, delay=1000) {
  // click 'all contributions' dropdown, select annotations

  var element = await page.evaluate(() => {
    return findElemByText({str: "All Contributions"})[0].click()
  })

  let annotations
  try {
    while (annotations < maxCount) {
      annotations = await page.evaluate(getAnnotations)
    }
  } catch (err) {
      console.log(err)
  }
  return annotations
}

function findElemByText({str, selector = '*', leaf = 'outerHTML'}) {
  // generate regex from string
  const regex = new RegExp(str, 'gmi');

  // search the element for specific word
  const matchOuterHTML = e => (regex.test(e[leaf]))

  // array of elements
  const elementArray = [...document.querySelectorAll(selector)];

  // return filtered element list
  return elementArray.filter(matchOuterHTML)
}

async function scrape() {
  process.setMaxListeners(100)
  const browser = await puppeteer.launch({
    headless : false
  })
  const page = await browser.newPage()
  var data

  await page.goto(config.genius_root + '/Eminem')
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

  await browser.close()
  return data
}

scrape()
  .then(data => { console.log(data) })
  .catch(err => { console.log(err) })
