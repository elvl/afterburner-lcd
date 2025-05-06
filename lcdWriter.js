import { SerialPort } from 'serialport'
import { sprintf } from 'sprintf-js'
import { config } from './config.js'

// Matrix Orbital LK Commands
// https://www.matrixorbital.com/index.php?route=extension/module/product_downloads/get&did=112
const CMD_CLEAR_SCREEN = Buffer.from([0xFE, 0x58])
const CMD_BACKLIGHT_ON = Buffer.from([0xFE, 0x42, 0x01])
const CMD_CURSOR_HOME = Buffer.from([0xFE, 0x48])
const CMD_SET_CURSOR_POS = (col, row) => Buffer.from([0xFE, 0x47, col + 1, row + 1])
const CMD_CONTRAST = (level) => Buffer.from([0xFE, 0x50, level])
const CMD_BRIGHTNESS = (level) => Buffer.from([0xFE, 0x99, level])


export class LcdWriter {
  constructor() {
    this.port = null
    this.isConnected = false
    this.queue = []
    this.isWriting = false
    this.connect()
  }

  connect() {
    console.log(`Attempting to connect to ${config.comPort} at ${config.baudRate} baud.`)

    this.port = new SerialPort({
      path: config.comPort,
      baudRate: config.baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false,
    })

    this.port.on('open', () => {
      this.isConnected = true;
      console.log(`Serial port ${config.comPort} opened.`)
      this.sendCommand(CMD_CLEAR_SCREEN)
      // this.sendCommand(CMD_BACKLIGHT_ON)
      // this.sendCommand(CMD_CONTRAST(128))
      this.sendCommand(CMD_BRIGHTNESS(255))
      this.processQueue()
    })

    this.port.on('error', (err) => {
      console.error('Serial port error:', err.message)
      this.isConnected = false
    })

    this.port.on('close', () => {
      console.log(`Serial port ${config.comPort} closed.`)
      this.isConnected = false
    })

    this.port.open((err) => {
      if (err) {
        console.error(`Error opening serial port ${config.comPort}:`, err.message)
        setTimeout(() => this.connect(), config.retryInterval)
      }
    })
  }

  sendCommand(data) {
    if (!Buffer.isBuffer(data)) {
        data = Buffer.from(data, 'utf8')
    }
    this.queue.push(data)
    this.processQueue()
  }

  processQueue() {
    if (this.isWriting || this.queue.length === 0 || !this.isConnected) {
      return
    }

    this.isWriting = true
    const data = this.queue.shift()

    this.port.write(data, (err) => {
      if (err) {
        console.error('Error writing to serial port:', err.message)
      }

      this.port.drain(() => {
        this.isWriting = false
        setTimeout(() => this.processQueue(), 50)
      })
    })
  }

  display(lines) {
    if (!this.isConnected) {
      return
    }

    this.sendCommand(CMD_CURSOR_HOME)

    for (let i = 0; i < Math.min(lines.length, config.lcdHeight); i++) {
      if (i !== 0) {
        this.sendCommand(CMD_SET_CURSOR_POS(0, i))
      }

      this.sendCommand(lines[i])
    }
  }

  formatLine(formatString, data) {
      if (!formatString || typeof formatString !== 'string') return ''.padEnd(config.lcdWidth, ' ')

      let line = formatString;

      // %<flags><width><precision><type>{varName}
      const regex = /%([-\+ 0#]*)?(\d+)?(\.\d+)?([bcdeufFosxX])\{([a-zA-Z0-9_]+)\}/g

      line = line.replace(regex, (match, flags, width, precision, type, varName) => {
        const value = data[varName]?.data
        const formatSpecifier = `%${flags || ''}${width || ''}${precision || ''}${type}`

        try {
          return sprintf(formatSpecifier, typeof value === 'number' ? value : String(value))
        } catch (e) {
          console.warn(`sprintf error for ${varName} with value ${value} and format ${formatSpecifier}: ${e.message}`)
          return '?'.padStart(parseInt(width || '1', 10), ' ')
        }
      })

      line = line.replace(/\{([a-zA-Z0-9_]+)\}/g, '?')
      return line.padEnd(config.lcdWidth, ' ').substring(0, config.lcdWidth)
  }

  clearScreen() {
    this.sendCommand(CMD_CLEAR_SCREEN)
  }

  close() {
    if (this.port && this.port.isOpen) {
      this.port.close()
    }
  }
}
