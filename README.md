# Spotify Auto Follow
Automatically follow all artists that are in a specified Spotify playlist

## Setup
1. Go to https://developer.spotify.com/dashboard and create a new app.
- Give it any name you'd like
- Set the Redirect URI to `http://localhost:8888/callback`
2. Grab the client ID and client secret that is generated
3. Duplicate the `env_example` file as `.env`, replacing the two settings with the ones generated from Spotify
4. Open a terminal and run `npm install` in the project directory to install necessary plugins

## Usage
1. Run `node index.js`
2. Open Spotify, find the playlist you'd like to follow artists in, click the Share button, then "Copy Link to Playlist"
3. Paste the full URL into the terminal window
4. The script will run and then open a browser window to tell you when it's done

You should now be following all artists!
