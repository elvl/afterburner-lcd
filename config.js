import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config()

const loadConfig = () => {
  return  {
    comPort: process.env.COM_PORT || 'COM3',
    baudRate: parseInt(process.env.BAUD_RATE || '9600', 10),
    lcdWidth: parseInt(process.env.LCD_WIDTH || '16', 10),
    lcdHeight: parseInt(process.env.LCD_HEIGHT || '2', 10),

    updateInterval: parseInt(process.env.UPDATE_INTERVAL || '1000', 10),
    retryInterval: parseInt(process.env.RETRY_INTERVAL || '30000', 10),

    lineFormats: (() => {
      const formats = []
      for (let i = 1; i <= (parseInt(process.env.LCD_HEIGHT || '2', 10)); i++) {
        formats.push(process.env[`LINE_FORMAT_${i}`] || '')
      }
      return formats
    })()
  }
}

export let config = loadConfig()

export const reloadConfig = () => {
  const envConfig = dotenv.parse(fs.readFileSync('.env'))
  for (const key in envConfig) {
    process.env[key] = envConfig[key]
  }
  config = loadConfig()
  console.log('The configuration file was reloaded successfully.')
  console.log(config)
}


