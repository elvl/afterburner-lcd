import path from 'path'
import { sprintf } from 'sprintf-js'
import { SysTray } from 'node-systray-v2'
import { showConsole, hideConsole } from 'node-hide-console-window'
import { fileURLToPath } from 'url'
import { config, reloadConfig } from './config.js'
import { LcdWriter } from './lcdWriter.js'
import { readMahmSharedMemory } from './mahmSharedMemory.js'
import { icoIconBase64 } from './ico-icon.js';

let lcd = null
let mainLoop = null
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const stopMainLoop = () => {
  if (mainLoop) {
    clearTimeout(mainLoop)
    mainLoop = null
  }
}

const updateDisplay = () => {
  stopMainLoop()

  if (lcd && lcd.isConnected) {
    const context = readMahmSharedMemory()

    if (context) {
      const lines = []
      for (let i = 0; i < config.lcdHeight; i++) {
        lines.push(lcd.formatLine(config.lineFormats[i], context))
      }

      lcd.display(lines)
      mainLoop = setTimeout(updateDisplay, config.updateInterval)
      return
    }

    lcd.display([
      'Connecting...'.padEnd(config.lcdWidth),
      'Data Error'.padEnd(config.lcdWidth)
    ])
  } else if (!lcd) {
    lcd = new LcdWriter()
  }

  mainLoop = setTimeout(updateDisplay, config.retryInterval)
}

const showData = () => {
  const context = readMahmSharedMemory()

  showConsole()
  console.log('')
  console.log('---------------------------------------------')
  console.log('                 recommended    current      ')
  console.log('  name                format      value      ')
  console.log('---------------------------------------------')

  for (const key of Object.keys(context).sort()) {
    const ctx = context[key]
    const line = [
      key.padStart(20),
      ctx.format?.padStart(7) || '',
    ]

    if (ctx.data !== undefined && ctx.format && ctx.units) {
      line.push(sprintf(ctx.format, typeof ctx.data === 'number' ? ctx.data : String(ctx.data)).padStart(10) + ' ' + ctx.units)
    } else if (ctx.data !== undefined) {
      line.push(ctx.data)
    }

    console.log(line.join(' '))
  }

  console.log('---------------------------------------------')
  console.log('Need more/less parameters? You can add/remove parameters in the monitoring settings of MSI Afterburner.')
}

const start = () => {
  stop()
  lcd = new LcdWriter()
  setTimeout(updateDisplay, 3000)
}

const stop = () => {
  stopMainLoop()
  if (lcd) {
    lcd.close()
  }
}

const shutdown = () => {
  console.log('Shutdown Afterburner LCD...')
  stop()
  process.exit(0)
}

const systray = new SysTray({
  menu: {
    icon: icoIconBase64,
    title: 'Afterburner LCD',
    tooltip: 'Afterburner LCD',
    items: [
      {
        title: 'Stop',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: 'Resme',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: 'Show Console',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: 'Hide Console',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: 'Reload Config',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: 'Show Data',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: 'Exit',
        tooltip: '',
        checked: false,
        enabled: true,
      },
    ],
  },
  debug: false,
  copyDir: true,
})

systray.onError((err) => {
  console.error(err)
})

systray.onReady(() => {
  start()
  console.log('This console window will automatically hide in the task tray after 5 seconds.')
  setTimeout(hideConsole, 5 * 1000)

  systray.onClick((event) => {
    if (event.seq_id === 0) {
      stop()
    } else if (event.seq_id === 1) {
      start()
    } else if (event.seq_id === 2) {
      showConsole()
    } else if (event.seq_id === 3) {
      hideConsole()
    } else if (event.seq_id === 4) {
      reloadConfig()
    } else if (event.seq_id === 5) {
      showData()
    } else if (event.seq_id === 6) {
      shutdown()
      systray.kill()
    }
  })
})

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)


