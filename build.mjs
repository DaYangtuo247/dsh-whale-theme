import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from './scripts/build.mjs'

const files = build(dirname(fileURLToPath(import.meta.url)))
console.log('built client.js from', files.join(', '))
