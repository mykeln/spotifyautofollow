require('dotenv').config();
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const readline = require('readline');
const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');


// Fuzzy search options
const options = {
  includeScore: true,
  threshold: 0.8, // Lower means more strict matching
  keys: ['name', 'artists.name']
};


const redirectUri = 'http://localhost:8888/callback';

const spotifyApi = new SpotifyWebApi({
  clientId: clientId,
  clientSecret: clientSecret,
  redirectUri: redirectUri,
});

const scopes = ['playlist-read-private', 'user-follow-modify', 'playlist-modify-private', 'playlist-modify-public'];
const state = 'some-state';

const authorizationUrl = spotifyApi.createAuthorizeURL(scopes, state);
console.log('Authorize this app by visiting the following URL:');
console.log(authorizationUrl);


// Function to read tracklist from the file
function readTracklistFromFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.split('\n').filter(Boolean)); // Split by new lines and remove empty lines
      }
    });
  });
}


// Function to search for a track
async function searchTrack(trackName) {
  try {
    const data = await spotifyApi.searchTracks(`track:${trackName}`, { limit: 5 });
    const fuse = new Fuse(data.body.tracks.items, options);
    const result = fuse.search(trackName);

    return result.length ? result[0].item : null;
  } catch (error) {
    console.error(`Error searching for track: ${trackName}`, error);
    return null;
  }
}

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

// Function to find a track and add it to the playlist
async function findAndAddTrack(trackName, playlistId) {
  try {
    const data = await spotifyApi.searchTracks(`track:${trackName}`, { limit: 5 });
    const fuse = new Fuse(data.body.tracks.items, options);
    const result = fuse.search(trackName);

    if (result.length) {
      const trackUri = result[0].item.uri;
      console.log(`Found: ${result[0].item.name} by ${result[0].item.artists.map(artist => artist.name).join(', ')}`);
      await addTrackToPlaylist(playlistId, trackUri);
      await downloadFromYouTube(trackName);

    } else {
      console.log(`Not found: ${trackName}`);
      // downloading the track from youtube instead
      await downloadFromYouTube(trackName);

    }
  } catch (error) {
    console.error(`Error searching for track: ${trackName}`, error);
  }
}

// Function to add a single track to the playlist
async function addTrackToPlaylist(playlistId, trackUri) {
  try {
    const response = await spotifyApi.addTracksToPlaylist(playlistId, [trackUri]);
    console.log(`Added track to playlist: ${response.body.snapshot_id}`);
  } catch (error) {
    console.error('Failed to add track to playlist:', error);
  }
}

// Function to iterate over the tracklist and add each found track to the playlist
async function processTracklist(tracks, playlistId) {
  for (const track of tracks) {
    await findAndAddTrack(track, playlistId);
  }
}

// Function to download a track from YouTube
function downloadFromYouTube(trackName) {
  return new Promise((resolve, reject) => {
    // Replace spaces with underscores for the filename
    const filename = trackName.replace(/\s+/g, '_') + '.mp3';

    // Call youtube-dl with the track name, requesting audio format and specifying the output filename
    const command = `youtube-dl "ytsearch1:${trackName}" --extract-audio --audio-format mp3 -o "${filename}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`youtube-dl error: ${error}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`youtube-dl stderr: ${stderr}`);
      }
      console.log(`youtube-dl stdout: Downloaded ${trackName}`);
      resolve(stdout);
    });
  });
}


// Import the open package using dynamic import
import('open').then(async (openModule) => {
  const open = openModule.default;

  // Get the desired playlist ID from the user before starting the server
  const playlistId = await getPlaylistIdFromUser();

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

      // Read the tracklist and process it after successful authentication
      const tracks = await readTracklistFromFile(path.join(__dirname, 'oakey-tracklist.txt'));
      await processTracklist(tracks, playlistId); // Ensure playlistId is available in this scope

      res.send('Successfully processed the tracklist. You can close this window.');
    } catch (error) {
      console.error('Error during authentication and track processing:', error);
      res.status(500).send('An error occurred. Check the console for more information.');
    } finally {
      // Close the web server in any case after processing
      server.close();
    }
  });

  // Start the server and open the user's browser for authentication
  const server = app.listen(8888, async () => {
    console.log('Web server is listening on port 8888');
    await open(authorizationUrl);
  });
});
