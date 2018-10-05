const gulp = require('gulp');
const rollup = require('rollup-stream');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('rollup-plugin-babel');
const commonJs = require('rollup-plugin-commonjs');
const resolveNodeModules = require('rollup-plugin-node-resolve');

const uglify = require('gulp-uglify');
const minify = require('gulp-minify');
const htmlmin = require('gulp-htmlmin');
const rename = require('gulp-rename');
const header = require('gulp-header');
const concat = require('gulp-concat-util');
const compress = require('gulp-minify-css');
const exec = require('child_process').exec;
const wbBuild = require('workbox-build');

const banner = "// CourtHive TMX\n";
const target = `/Users/charlesallen/Development/node/CourtHive/app/static/TMX/`;

const babelConfig = {
  "presets": [ [ "es2015", { "modules": false } ] ],
  "plugins": [ "external-helpers" ],
  babelrc: false
};

/**
 * https://duske.me/using-rollup-js-with-gulp-js/
 * Use rollup in gulp making it compatible with streams
 * @param {String} inputFile path to main JS file
 * @param {Object} options configuration object containing format, basePath, und distPath
 */
const rollupJS = (inputFile, options) => {
  return () => {

    let config = {
      input: options.basePath + inputFile,
      format: options.format,
      output: {
         strict: false
      },
      plugins: [
        babel(babelConfig),
        resolveNodeModules(),
        commonJs(),
      ]
    }

    if (process.env.live) {
       return rollup(config)
       .pipe(source(inputFile, options.basePath))
       .pipe(buffer())
       .pipe(sourcemaps.init({loadMaps: true}))
       .pipe(uglify())
       .pipe(header(banner))
       .pipe(gulp.dest(options.distPath));
    } else {
       return rollup(config)
       .pipe(source(inputFile, options.basePath))
       .pipe(buffer())
       .pipe(sourcemaps.init({loadMaps: true}))
       .pipe(header(banner))
       .pipe(gulp.dest(options.distPath));
    }

  };
}

gulp.task('default', ['bundle-sw']);

gulp.task('copy-maps', function() {
   return gulp.src([
         'node_modules/socket.io-client/dist/socket.io.js.map',
         'node_modules/awesomplete/awesomplete.min.js.map',
      ])
      .pipe(gulp.dest(target + '/lib'));
});

// minimize external libraries that do not provide minimized verion
gulp.task('uglify-lib', function() {
	return gulp.src([ 
      'node_modules/pikaday/pikaday.js',
   ])
   .pipe(uglify())
   .pipe(concat('bundle.min.js'))
   .pipe(gulp.dest('src/external'));
});

gulp.task('concat-lib', ['uglify-lib'], function() {
	return gulp.src([ 
      'node_modules/dexie/dist/dexie.min.js',
      'node_modules/circular-json/build/circular-json.js',
      'node_modules/socket.io-client/dist/socket.io.js',
      'node_modules/qrious/dist/qrious.min.js',
      'node_modules/awesomplete/awesomplete.min.js',
      'node_modules/leaflet/dist/leaflet.js',
      'node_modules/moment/min/moment.min.js',
      'node_modules/sanitize-html/dist/sanitize-html.min.js',
      'node_modules/intro.js/minified/intro.min.js',

      'src/external/quill.min.js',
      'src/external/d3.superformula.min.js',
      'src/external/bundle.min.js',
   ])
   .pipe(concat('lib_bundle.js'))
   .pipe(gulp.dest(target + '/lib'));
});

gulp.task('rollup', rollupJS('main.js', {
  basePath: './src/',
  format: 'iife',
  distPath: './build',
}));

gulp.task('copy-src', ['concat-src'], function() {
   return gulp.src(['./dist/source.js'])
      .pipe(gulp.dest(target));
});

gulp.task('copy-icons', function() {
   return gulp.src(['icons/*'])
      .pipe(gulp.dest(target + '/icons'));
});

gulp.task('compress-html', function() {
  return gulp.src('dist/index.html')
    .pipe(htmlmin({collapseWhitespace: true}))
    .pipe(gulp.dest(target));
});

gulp.task('copy-lib', function() {
   return gulp.src(['dist/lib/*'])
      .pipe(gulp.dest(target + '/lib'));
});

gulp.task('copy-css-img', function() {
   return gulp.src(['src/css/img/*'])
      .pipe(gulp.dest(target + '/css/img'));
});

gulp.task('copy-fonts', function() {
   return gulp.src(['dist/fonts/*'])
      .pipe(gulp.dest(target + '/fonts'));
});

gulp.task('copy-assets', function() {
   return gulp.src(['assets/**/*'])
      .pipe(gulp.dest(target + '/assets'));
});

gulp.task('compress-css', function() {
	return gulp.src(['src/css/*.css'])
		.pipe(compress())
		.pipe(rename({ suffix: '.min' }))
		.pipe(gulp.dest('minimized'));
});

gulp.task('concat-css', ['compress-css'], function() {
	return gulp.src([ 'minimized/*.css', ])
      .pipe(concat('style.css'))
		.pipe(gulp.dest(target + '/css'));
});

gulp.task('concat-src', ['rollup', 'compress-html'], function() {
   let list = [];
   if (process.env.live) {
      list.push('build/production.js');
   } else {
      list.push('build/dev.js');
   }
   list.push('build/main.js');
	return gulp.src(list)
      .pipe(concat('source.js'))
		.pipe(gulp.dest('./dist'));
});

gulp.task('bundle-sw', [
      'copy-maps',
      'copy-src',
      'copy-lib',
      'copy-icons',
      'concat-css',
      'concat-lib',
      'copy-fonts',
      'copy-assets',
      'copy-css-img'
   ], () => {
     return wbBuild.generateSW({
       globDirectory: target,
       swDest: `${target}/sw.js`,
       globPatterns: ['**\/*.{html,js,css,png,json,xlsx}'],
       clientsClaim: true,
       skipWaiting: true
     })
     .then(() => {
       console.log('Service worker generated.');
     })
     .catch((err) => {
       console.log('[ERROR] This happened: ' + err);
     });
   }
)

gulp.task('watch', ['bundle-sw'], () => {
  gulp.watch('src/**/*.js', [/* do some linting etc., */ 'copy-src']);
  gulp.watch('src/css/*.css', [/* do some linting etc., */ 'concat-css']);
});

