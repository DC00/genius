from bs4 import BeautifulSoup
import requests
from time import sleep
from pymongo import MongoClient

global url
global last_page
global current_page
global artists
url="http://genius.com/verified-artists?page=1"
last_page = 135
current_page = 1
artists = []
headers = {'user-agent' : 'Chrome/51.0.2 (Macintosh; Intel Mac OS X 10.11.5); Daniel Coo/coo.danielj@gmail.com'}

def make_artist(artist_name, artist_iq):
	global artists
	a = {
		'name': artist_name,
		'iq': artist_iq
	}
	artists.append(a)

def print_artists():
	for a in artists:
		print(a['name']),
		print(a['iq'])

def find_next_page(soup):
	global current_page
	if current_page == last_page:
		return current_page
	pagination = soup.find('div', {'class' : 'pagination'})
	container = pagination.find('a', {'class' : 'next_page'})
	next_page = container['href'][23:]
	return next_page

def update(next_page):
	global url
	global current_page
	url = url[:40] + str(next_page)
	current_page += 1

def main():
	client = MongoClient()
	db = client.genius
	collection = db['artists']
	while current_page <= last_page:
		print(current_page)
		client = requests.Session()
		response = client.get(url, headers=headers)

		soup = BeautifulSoup(response.text, 'html.parser')
		data = soup.find_all('div', attrs={'class':'user_details'})
		for container in data:
			tags = container.find_all('a')
			name = tags[0]['data-id']
			iq = int(tags[1].contents[0].replace(',', ''))
			make_artist(name, iq)

		next_page = find_next_page(soup)
		update(next_page)
		sleep(5)

	result = collection.insert_many(artists)
	print("done!")
	
if __name__ == "__main__":
	main()

