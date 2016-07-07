from bs4 import BeautifulSoup
import requests
from pymongo import MongoClient
import sys
from make_profiles import update_artist
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import NoSuchElementException

URL="http://genius.com/search?q="
BASE_URL="http://genius.com/"
NOT_FOUND="http://genius.com/#"

def get_missing_artists(db):
	cursor = db.find({ 'followers' : { '$exists' : False} })
	missing_artists = []
	for result_object in cursor:
		missing_artists.append(result_object)
	return missing_artists

def querify(name):
	name = name.lower().replace(' ', '+')
	name = name.replace('&', '%26')
	return name

def extract_url(div):
	html = div.get_attribute('innerHTML')
	little_soup = BeautifulSoup(html, 'html.parser')

	p = little_soup.find('p')
	new_url = p.find('a')['href']
	new_url = new_url.replace('/', '')

	return BASE_URL + new_url

def scrape_results_page(client, url):
	response = client.get(url)
	soup = BeautifulSoup(response.text, 'html.parser')
	browser = webdriver.PhantomJS()
	browser.get(url)
	new_url = 0

	try:
		verified_div = browser.find_element_by_xpath("//div[@class='user_badge verified_artist contributor']")
		new_url = extract_url(verified_div)
	except NoSuchElementException:
		try:
			verified_div = browser.find_element_by_xpath("//div[@class='user_badge verified_artist']")
			new_url = extract_url(verified_div)
		except NoSuchElementException:
			try:
				verified_div = browser.find_element_by_xpath("//div[@class='user_badge verified_artist editor contributor']")
				new_url = extract_url(verified_div)
			except NoSuchElementException:
				try:
					verified_div = browser.find_element_by_xpath("//div[@class='user_badge verified_artist contributor']")
					new_url = extract_url(verified_div)
				except NoSuchElementException:
					try:
						verified_div = browser.find_element_by_xpath("//div[@class='user_badge verified_artist moderator editor contributor']")
						new_url = extract_url(verified_div)
					except NoSuchElementException:
						new_url = 0


	browser.quit()
	return new_url

def fix_url(artist, db):
	print(artist)
	client = requests.Session()
	search_url = URL
	search_url = URL + querify(artist['name'])
	new_url = scrape_results_page(client, search_url)

	if not is_int(new_url):
		print new_url
		update_artist(artist, new_url, client, db) 
	else:
		print NOT_FOUND
		update_url(artist, NOT_FOUND, db)

def update_url(artist, url, db):
	db.find_one_and_update(
		{ '_id' : artist['_id'] },
		{ '$set': {
				'url' : url	
			}
		})

def is_int(x):
	return isinstance(x, (int, long))

def manually_update(a, db):
	rclient = requests.Session()
	update_artist(a, "http://genius.com/21themusician", rclient, db)


def main():
	client = MongoClient()
	db = client.genius['artists']

	missing_artists = get_missing_artists(db)

	for a in missing_artists:
	 	fix_url(a, db)
	 	print('\n')

if __name__ == "__main__":
	main()

