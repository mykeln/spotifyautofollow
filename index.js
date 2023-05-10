const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const readline = require('readline');
require('dotenv').config();


const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

const redirectUri = 'http://localhost:8888/callback';

const spotifyApi = new SpotifyWebApi({
  clientId: clientId,
  clientSecret: clientSecret,
  redirectUri: redirectUri,
});

const scopes = ['playlist-read-private', 'user-follow-modify'];
const state = 'some-state';

const authorizationUrl = spotifyApi.createAuthorizeURL(scopes, state);
console.log('Authorize this app by visiting the following URL:');
console.log(authorizationUrl);


// Import the open package using dynamic import
import('open').then(async (openModule) => {
  const open = openModule.default;

  // Set up the Express web server to handle the OAuth 2.0 redirect
  const app = express();
  app.get('/callback', async (req, res) => {
    const code = req.query.code;

    try {
      const data = await spotifyApi.authorizationCodeGrant(code);
      const accessToken = data.body['access_token'];
      const refreshToken = data.body['refresh_token'];
      spotifyApi.setAccessToken(accessToken);
      spotifyApi.setRefreshToken(refreshToken);

      await followArtistsInPlaylist(playlistId);
      res.send('Successfully followed artists. You can close this window.');
    } catch (error) {
      console.error('Error getting tokens:', error);
      res.status(500).send('An error occurred. Check the console for more information.');
    }

    // Close the web server
    server.close();
  }); 

  const server = app.listen(8888, () => {
    // Web server is listening on port 8888
    //console.log('Web server is listening on port 8888');
  });  

  // Get the desired playlist from the user
  const playlistId = await getPlaylistIdFromUser();  

  // Open the authorization URL in the user's default browser
  await open(authorizationUrl);

});

async function getPlaylistIdFromUser() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Please enter the URL of the playlist: ', (input) => {
      const match = input.match(/playlist\/([\w\d]+)/);
      const playlistId = match && match[1];

      if (playlistId) {
        console.log(`Playlist ID: ${playlistId}`);
        resolve(playlistId);
      } else {
        console.error('Invalid playlist URL. Please check the input and try again.');
        process.exit(1);
      }

      rl.close();
    });
  });
}


async function followArtistsInPlaylist(playlistId) {
  try {
    const response = await spotifyApi.getPlaylistTracks(playlistId);
    
    if (!response.body.items) {
      console.error('Unexpected response format:', response.body);
      return;
    }

    const tracks = response.body.items;
    const artistIds = new Set();

    for (const track of tracks) {
      for (const artist of track.track.artists) {
        artistIds.add(artist.id);
      }
    }

    const followResponse = await spotifyApi.followArtists([...artistIds]);
    console.log('Successfully followed artists:', followResponse);
  } catch (error) {
    console.error('Error following artists:', error);
  }
}
