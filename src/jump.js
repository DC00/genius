const config = require('./config.json')
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')

puppeteer.launch({headless : true }).then(async browser => {
  const promises = []
  const innerPromises = []
  let data = []
  for(var i = 1; i < config.max_page; i++) {
    promises.push(browser.newPage().then(async page => {
      await page.goto(config.verified_artists_url + i)
      const html = await page.content()
      const $ = cheerio.load(html)
      data = await Promise.all($('.badge_container').map(async (inx, badge) => {
        const name = $(badge).find('[data-id]').text().trim()
        const iq = $(badge).find('.iq').text().trim()
        const url = $(badge).find('a').attr('href')
        return {name, iq, url}
      }).get())
      console.log(data)
    }))
  }
  
  try {
    await Promise.all(promises)
  } catch (err) {
    console.log(err) 
  }
  browser.close()
})
