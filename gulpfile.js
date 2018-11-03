const gulp = require("gulp")
const parcel = require("gulp-parcel")
const replace = require("gulp-replace")
const rename = require("gulp-rename")
const eslint = require("gulp-eslint")
const path = require("path")
const del = require("del")
const os = require("os")
const fs = require("fs")
const { spawn } = require("child_process")
const { URL } = require("url")

const paths = {
  scripts:     ["conf.priv.js", "completions.js", "conf.js", "actions.js", "help.js", "keys.js", "util.js"],
  entry:       "conf.js",
  gulpfile:    ["gulpfile.js"],
  readme:      ["README.tmpl.md"],
  screenshots: "assets/screenshots",
}

// This notice will be injected into the generated README.md file
const disclaimer = `\
<!--

NOTICE:
This is an automatically generated file - Do not edit it directly.
The source file is README.tmpl.md

-->`

gulp.task("gulp-autoreload", () => {
  let p
  const spawnChildren = function spawnChildren() {
    if (p) p.kill()
    p = spawn("gulp", ["lint-gulpfile", "install", "watch-nogulpfile"], { stdio: "inherit" })
  }
  gulp.watch("gulpfile.js", spawnChildren)
  spawnChildren()
})

gulp.task("clean", () => del(["build", ".cache", ".tmp-gulp-compile-*"]))

gulp.task("lint", () =>
  gulp
    .src([].concat(paths.scripts, paths.gulpfile))
    .pipe(eslint())
    .pipe(eslint.format()))

gulp.task("lint", () =>
  gulp
    .src(paths.gulpfile)
    .pipe(eslint())
    .pipe(eslint.format()))

gulp.task("check-priv", () => {
  try {
    fs.statSync("./conf.priv.js")
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("Creating ./conf.priv.js based on ./conf.priv.example.js")
    fs.copyFileSync("./conf.priv.example.js", "./conf.priv.js", fs.constants.COPYFILE_EXCL)
  }
})

gulp.task("build", ["check-priv", "clean", "lint", "readme"], () => gulp.src(paths.entry, { read: false })
  .pipe(parcel())
  .pipe(rename(".surfingkeys"))
  .pipe(gulp.dest("build")))

gulp.task("install", ["build"], () => gulp.src("build/.surfingkeys")
  .pipe(gulp.dest(os.homedir())))

gulp.task("watch", () => {
  gulp.watch([].concat(paths.scripts, paths.gulpfile), ["readme", "install"])
  gulp.watch(paths.readme, ["readme"])
})

gulp.task("watch-nogulpfile", () => {
  gulp.watch([].concat(paths.scripts), ["readme", "install"])
  gulp.watch(paths.readme, ["readme"])
})

gulp.task("readme", () => {
  const compl = require("./completions") // eslint-disable-line global-require
  const screens = {}
  let screenshotList = ""
  fs.readdirSync(path.join(__dirname, paths.screenshots)).forEach((s) => {
    const file = path.basename(s, ".png").split("-")
    const alias = file[0]
    if (!screens[alias]) {
      screens[alias] = []
    }
    screens[alias].push(path.join(paths.screenshots, path.basename(s)))
  })
  const table = Object.keys(compl).sort((a, b) => {
    if (a < b) return -1
    if (a > b) return 1
    return 0
  }).reduce((a, k) => {
    const c = compl[k]
    const u = new URL(c.search)
    const domain = (u.hostname === "cse.google.com") ? "Google Custom Search" : u.hostname
    let s = ""
    if (screens[c.alias]) {
      screens[c.alias].forEach((url, i) => {
        const num = (i > 0) ? ` ${i + 1}` : ""
        s += `[:framed_picture:](#${c.name}${num.replace(" ", "-")}) `
        screenshotList += `##### ${c.name}${num}\n`
        screenshotList += `![${c.name} screenshot](./${url})\n\n`
      })
    }
    return `${a}| \`${c.alias}\` | \`${c.name}\` | \`${domain}\` | ${s} |\n`
  }, "")
  return gulp.src(["./README.tmpl.md"])
    .pipe(replace("<!--{{DISCLAIMER}}-->", disclaimer))
    .pipe(replace("<!--{{COMPL_COUNT}}-->", Object.keys(compl).length))
    .pipe(replace("<!--{{COMPL_TABLE}}-->", table))
    .pipe(replace("<!--{{SCREENSHOTS}}-->", screenshotList))
    .pipe(rename("README.md"))
    .pipe(gulp.dest("."))
})

gulp.task("default", ["build"])
