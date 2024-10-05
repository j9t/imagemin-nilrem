const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const simpleGit = require('simple-git')
const testFolder = path.join(__dirname, '../media/test')
const testFolderGit = path.join(__dirname, '../media/test-git')
const imageminGuardScript = path.join(__dirname, '../bin/imagemin-guard.js')
// Crutch to avoid files like .DS_Store to sneak in
// @@ Consolidate with package, to keep image definitions DRY
const allowedFileTypes = ['avif', 'gif', 'jpg', 'jpeg', 'png', 'webp']

// Function to copy files
function copyFiles(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }
  fs.readdirSync(srcDir).forEach(file => {
    const srcFile = path.join(srcDir, file)
    const destFile = path.join(destDir, file)
    fs.copyFileSync(srcFile, destFile)
  })
}

// Function to check if images are compressed
function areImagesCompressed(dir) {
  const uncompressedFiles = []
  const allCompressed = fs.readdirSync(dir).every(file => {
    const ext = path.extname(file).slice(1)
    if (!allowedFileTypes.includes(ext)) return true
    const filePath = path.join(dir, file)
    const originalFilePath = path.join(testFolder, file)
    const originalStats = fs.statSync(originalFilePath)
    const compressedStats = fs.statSync(filePath)
    const isCompressed = compressedStats.size < originalStats.size
    if (!isCompressed) {
      uncompressedFiles.push(file)
    }
    return isCompressed
  })
  return { allCompressed, uncompressedFiles }
}

// Function to check if images are already compressed
function areImagesAlreadyCompressed(dir) {
  return fs.readdirSync(dir).some(file => {
    const ext = path.extname(file).slice(1)
    if (!allowedFileTypes.includes(ext)) return false
    const filePath = path.join(dir, file)
    const originalFilePath = path.join(testFolder, file)
    const originalStats = fs.statSync(originalFilePath)
    const compressedStats = fs.statSync(filePath)
    return compressedStats.size >= originalStats.size
  })
}

describe('Imagemin Guard', () => {
  beforeAll(() => {
    // Backup original images
    copyFiles(testFolder, testFolderGit)
  })

  afterAll(() => {
    // Clean up temporary folder
    fs.rmSync(testFolderGit, { recursive: true })
  })

  test('Compress images from media/test folder (in temp location)', () => {
    // Ensure images in temp folder are not already compressed
    expect(areImagesAlreadyCompressed(testFolderGit)).toBe(true)

    // Run imagemin-guard script
    execSync(`node ${imageminGuardScript} --ignore=media/test`)

    // Verify images are compressed
    const { allCompressed, uncompressedFiles } = areImagesCompressed(testFolderGit)
    if (uncompressedFiles.length > 0) {
      // @@ Ensure all compressed files are listed
      console.log('The following files were not compressed:', uncompressedFiles.join(', '))
    }
    expect(allCompressed).toBe(true)
  })

  test('Compress only staged images from media/test folder (in temp location)', async () => {
    const git = simpleGit(testFolderGit)

    // Ensure the temp folder exists
    if (!fs.existsSync(testFolderGit)) {
      fs.mkdirSync(testFolderGit, { recursive: true })
    }

    // Initialize a temporary Git repository
    await git.init()
    await git.addConfig('user.name', 'Test User')
    await git.addConfig('user.email', 'test@example.com')

    // Stage files
    await git.add('.')

    // Run imagemin-guard script with --staged option
    execSync(`node ${imageminGuardScript} --staged`, { cwd: testFolderGit })

    // Verify images are compressed
    const { allCompressed, uncompressedFiles } = areImagesCompressed(testFolderGit)
    if (uncompressedFiles.length > 0) {
      console.log('The following files were not compressed:', uncompressedFiles.join(', '))
    }
    expect(allCompressed).toBe(true)
  })
})