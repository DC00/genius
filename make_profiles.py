from bs4 import BeautifulSoup
from camelcase import CamelCase
from pymongo import MongoClient
import requests
import sys
import time
from unidecode import unidecode

BASE_URL="http://genius.com/"

alternates = {
	'Raury' : 'KingRaur',
	'3010'  : 'Troismilledix',
}

def make_url(artist):
	name = artist['name'].replace(' ', '')
	c = CamelCase()
	ccname = c.hump(name)
	ccname = ccname.replace('.', '')
	return BASE_URL + unidecode(ccname)

def url_is_good(url, rclient):
	response = rclient.get(url)
	return response.status_code == 200

def get_followers(info):
	info = info.strip()
	info = info.replace('Followed by', '')
	info = info.replace('users', '')
	info = info.replace('user', '')
	followers = int(info.replace(',', ''))
	return followers

def get_annotations(info):
	info = info.replace('Annotations (', '')
	info = info.replace(')', '')
	info = info.strip()
	annotations = int(info.replace(',', ''))
	return annotations

def update_artist(artist, url, rclient, db):
	response = rclient.get(url)
	if response.status_code == 404:
		print artist['name']
		return False
	elif artist['name'] in alternates.keys() and response.status_code == 200:
		return False
	elif response.status_code != 200:
		return False
	soup = BeautifulSoup(response.text, 'html.parser')
	data = soup.find('button', {'class' : 'button see_followers profile_user_info-button'})	
	more_data = soup.find('a', {'href' : '#annotations-tab'})
	followers = get_followers(data.contents[0])
	annotations = get_annotations(more_data.contents[0])
	
	db.find_one_and_update(
		{'_id': artist['_id']},
		{'$set': {
			'followers'   : followers, 
			'annotations' : annotations,
			'url'  : url
			}
		}
	)
	print artist['name'] + " 200 !!"
	return True

def main():
	client = MongoClient()
	db = client.genius['artists']

	cursor = db.find()
	artists = []
	for result_object in cursor:
		artists.append(result_object)
	
	rclient = requests.Session()
	for a in artists:
		if 'followers' not in a.keys():
			artist_url = make_url(a)
			u = update_artist(a, artist_url, rclient, db)

if __name__ == "__main__":
	main()
