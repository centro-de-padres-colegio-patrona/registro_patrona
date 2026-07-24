// Configurations

// Imports
import dotenv from 'dotenv'

// Load .env
dotenv.config({ path: './.env.local' })

// URL
export const URL_API = process.env.REACT_APP_URL_API
export const URL_WEB = process.env.REACT_APP_URL_WEB

// Oauth
export const OAUTH_FACEBOOK_ID = process.env.REACT_APP_OAUTH_FACEBOOK_ID
export const OAUTH_GOOGLE_ID = process.env.REACT_APP_OAUTH_GOOGLE_ID
export const OAUTH_INSTAGRAM_ID = process.env.REACT_APP_OAUTH_INSTAGRAM_ID
export const OAUTH_LINKEDIN_ID = process.env.REACT_APP_OAUTH_LINKEDIN_ID
export const OAUTH_TWITTER_ID = process.env.REACT_APP_OAUTH_TWITTER_ID
export const OAUTH_REDDIT_ID = process.env.REACT_APP_OAUTH_REDDIT_ID
export const OAUTH_DISCORD_ID = process.env.REACT_APP_OAUTH_DISCORD_ID
export const OAUTH_ZOOM_ID = process.env.REACT_APP_OAUTH_ZOOM_ID

export const OAUTH_GITHUB_ID = process.env.REACT_APP_OAUTH_GITHUB_ID
export const OAUTH_GITLAB_ID = process.env.REACT_APP_OAUTH_GITLAB_ID
export const OAUTH_DIGITALOCEAN_ID = process.env.REACT_APP_OAUTH_DIGITALOCEAN_ID
export const OAUTH_BITBUCKET_ID = process.env.REACT_APP_OAUTH_BITBUCKET_ID
export const OAUTH_AZURE_ID = process.env.REACT_APP_OAUTH_AZURE_ID
export const OAUTH_AZURE_TENANT = process.env.REACT_APP_OAUTH_AZURE_TENANT

export const OAUTH_SPOTIFY_ID = process.env.REACT_APP_OAUTH_SPOTIFY_ID
export const OAUTH_SHOPIFY_ID = process.env.REACT_APP_OAUTH_SHOPIFY_ID
export const OAUTH_SHOPIFY_STORE = process.env.REACT_APP_OAUTH_SHOPIFY_STORE

export const DATABASE_YEAR_NAME = process.env.DATABASE_YEAR_NAME || ''


export const FLOW_API_KEY = process.env.FLOW_API_KEY || flow_api_key
export const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || flow_secret_key

export const LOCAL_PORT = process.env.LOCAL_PORT || 5001

export const API_KEY = process.env.API_KEY || '123456'

export const URL_SERVER = process.env.URL_SERVER || 'https://registro-patrona.onrender.com'


/// Database 
export const DB_USER = process.env.DB_USER
export const DB_PASSWORD = process.env.DB_PASSWORD
export const DB_URL = process.env.DB_URL
export const DB_MAIN_DATABASE_NAME = process.env.DB_MAIN_DATABASE_NAME
