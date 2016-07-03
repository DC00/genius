from bs4 import BeautifulSoup
from pymongo import MongoClient
import requests

def main():
	client = MongoClient()
	db = client.genius
	collection = db['artists']
	cursor = collection.find()
	artists = []
	for result_object in cursor:
		# result_object is a dict that holds json
		artists.append(result_object)

	for a in artists:
		artist_url = make_url(a)
		update_artist(a, artist_url)

if __name__ == "__main__":
	main()
