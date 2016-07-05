from bs4 import BeautifulSoup
import requests
from pymongo import MongoClient
import sys
import make_profiles
from selenium import webdriver
from selenium.webdriver.common.keys import Keys

URL="http://genius.com/search?q="
BASE_URL="http://genius.com/"

def get_missing_artists(db):
	cursor = db.find({ 'followers' : { '$exists' : False} })
	missing_artists = []
	for result_object in cursor:
		missing_artists.append(result_object)
	return missing_artists

def querify(name):
	name = name.lower().replace(' ', '+')
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
	print url
	soup = BeautifulSoup(response.text, 'html.parser')
	browser = webdriver.Firefox()
	browser.get(url)
	verified_div = browser.find_element_by_xpath("//div[@class='user_badge verified_artist contributor']")
	new_url = extract_url(verified_div)
	browser.quit()
	
	return new_url

def fix_url(artist):
	client = requests.Session()
	search_url = URL + querify(artist['name'])
	new_url = scrape_results_page(client, search_url)
	print new_url
# 	updated_profile = update_profille method from imported make_profile

def main():
	client = MongoClient()
	db = client.genius['artists']
	
	missing_artists = get_missing_artists(db)
	# for a in missing_artists:
	# 	new_url = find_alternate_name(a)
	rombes = missing_artists[1]	
	fix_url(rombes)

if __name__ == "__main__":
	main()

