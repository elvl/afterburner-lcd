import fs from 'fs'
import Struct from 'structron'
import { camelCase } from 'lodash-es'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const NodeIPC = require('node-easy-ipc')
const map = new NodeIPC.FileMapping()

// MSI Afterburner/SDK/Include/MAHMSharedMemory.h

/*
  available parameters
  ------------------------

  name                      example   unit
  ------------------------  --------  -----
  gpuTemperature            30.625..  ℃
  gpuUsage                  1.7399..  %

  cpuUsage                  1.7399..  %
  cpu1Usage, cpu2Usage ...  1.7399..  %
  cpuTemperature            30.625..  ℃
  cpu1Temperature ...       30.625..  ℃
  cpuClock                  3400      MHz
  cpu1Clock ...             3400      MHz
  cpuPower                  0.4039..  W
  cpu1Power ...             0.4039..  W

  power                     10.015..  W
  coreClock                 210       MHz
  memoryClock               405       MHz
  fbUsage                   30        %
  vidUsage                  0         %
  busUsage                  0         %
  memoryUsage               793.56..  MB
  ramUsage                  11769     MB
  commitCharge              15997     MB
  fanSpeed                            RPM
  fanSpeed2                           RPM
  fanTachometer                       RPM
  fanTachometer2                      RPM
  tempLimit
  powerLimit
  voltageLimit
  noLoadLimit
  framerate                           FPS
*/

const MAX_PATH = 260

const MahmHeader = new Struct()
  .addMember(Struct.TYPES.UINT, 'signature')
  .addMember(Struct.TYPES.UINT, 'version')
  .addMember(Struct.TYPES.UINT, 'headerSize')
  .addMember(Struct.TYPES.UINT, 'numEntries')
  .addMember(Struct.TYPES.UINT, 'entrySize')
  .addMember(Struct.TYPES.INT, 'time')

const MahmEntry = new Struct()
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'name')
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'units')
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'localizedName')
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'localizedUnits')
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'format')
  .addMember(Struct.TYPES.FLOAT, 'data')
  .addMember(Struct.TYPES.FLOAT, 'minLimit')
  .addMember(Struct.TYPES.FLOAT, 'maxLimit')
  .addMember(Struct.TYPES.UINT, 'flags')
  .addMember(Struct.TYPES.UINT, 'gpu')
  .addMember(Struct.TYPES.UINT, 'srcId')

const MahmGpuEntry = new Struct()
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'gpuId')
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'family')
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'device')
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'driver')
  .addMember(Struct.TYPES.STRING(MAX_PATH), 'bios')
  .addMember(Struct.TYPES.UINT, 'memAmount')


export const readMahmSharedMemory = () => {
  try {
    map.openMapping('MAHMSharedMemory', 0)
  } catch (err) {
    console.error(`Error fetching data: MSI Afterburner may not be running.`, err.message)
    return null
  }

  const buffer = Buffer.alloc(MahmHeader.SIZE)
  map.readInto(buffer, 0, 0, buffer.length) // *buffer, destOffest, srcOffset, length
  const header = MahmHeader.readContext(buffer).data
  const entries = {}

  if (header.numEntries) {
    const entryBuffer = Buffer.alloc(header.entrySize * header.numEntries + MahmGpuEntry.SIZE)
    map.readInto(entryBuffer, 0, header.headerSize, entryBuffer.length)
    map.closeMapping()

    for (let i = 0; i < header.numEntries; i++) {
      const entry = MahmEntry.readContext(entryBuffer, header.entrySize * i).data
      const key = camelCase(entry.name)
      entries[key] = entry
    }

    const gpu = MahmGpuEntry.readContext(entryBuffer, header.entrySize * header.numEntries).data
    for (const key of Object.keys(gpu)) {
      entries[camelCase('gpuInfo ' + key)] = { data: gpu[key] }
    }

    return entries

  } else {
    map.closeMapping()
    console.error(`Error fetching data: no data entries`)
    return null
  }
}

