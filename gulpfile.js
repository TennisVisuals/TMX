var gulp = require('gulp');
var babel = require("gulp-babel");
var htmlmin = require('gulp-htmlmin');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var minify = require('gulp-minify');
var header = require('gulp-header');
var concat = require('gulp-concat-util');
var compress = require('gulp-minify-css');
var exec = require('child_process').exec;

var banner = "// CourtHive Ranking\n";

let pkg = {
   source: 'source',
   min: 'minimized',
   destination: '/Users/posiwid/Development/Projects/node/AiP/v4/app/static/ranking',
}

gulp.task('copy-manifest', function() {
   return gulp.src(['./*.manifest', 'manifest.json'])
      .pipe(gulp.dest(pkg.destination));
});

gulp.task('compress-css', function() {
	return gulp.src(['css/*.css'])
		.pipe(compress())
		.pipe(rename({ suffix: '.min' }))
		.pipe(gulp.dest(pkg.min));
});

gulp.task('concat-css', function() {
	return gulp.src([ 'minimized/*.css', ])
      .pipe(concat('style.css'))
		.pipe(gulp.dest(pkg.destination + '/css'));
});

gulp.task('concat-lib', function() {
	return gulp.src([ 
         '../components/minimized/awesomplete.min.js',
         '../components/minimized/dexie.min.js',
         '../components/minimized/d3.v4.min.js',
         '../components/minimized/aip.min.js',
         '../components/minimized/UUID.min.js',
         '../components/minimized/d3.superformula.min.js',
         '../components/minimized/leaflet.min.js',
         '../components/minimized/pdfmake.min.js',
         '../components/minimized/vfs_fonts.js',
         '../components/minimized/socket.io.min.1.7.2.js',

         '../components/ugly/ladderChart.min.js',
         '../components/ugly/yearCal.min.js',

         '../components/src/dynamicDraw.js',
         '../components/src/contextMenu.js',
         '../components/src/floatingEntry.js',
         '../components/src/timeSeries.js',

         '../components/src/diacritics.js',
         '../components/src/moment.js',
         '../components/src/pikaday.js',
         '../components/src/cleanScore.js',

         '../components/minimized/xlsx.core.min.js',
      ])
      .pipe(concat('lib_bundle.js'))
		.pipe(gulp.dest(pkg.destination + '/lib'));
});

gulp.task('ugly-src', function() {
	return gulp.src([ 
         '../components/src/UUID.js',
      ])
      .pipe(babel())
      .pipe(uglify())
      .pipe(rename({ suffix: '.min' }))
		.pipe(gulp.dest('./ugly'));
});

gulp.task('concat-idioms', function() {
   // files must be in correct order => dependencies
	return gulp.src([ 
         'src/lang.js', 
         'src/idioms/???.idiom',
      ])
      .pipe(concat('idioms.js'))
      .pipe(gulp.dest('src/idioms/'));
});
gulp.task('concat-src', function() {
   // files must be in correct order => dependencies
	return gulp.src([ 
         'src/coms.js', 
         'src/db.js', 
         'src/util.js', 
         'src/load.js', 
         'src/files.js', 
         'src/search.js', 
         'src/idioms/idioms.js', 
         'src/tabs.js', 
         'src/dropdown.js', 
         'src/display.js', 
         'src/points.js', 
         'src/rank.js', 
         'src/xlsDraws.js', 
         'src/hts.js', 
         'src/config.js',
         'src/main.js',
         'src/player.js',
         'src/tournaments.js',
         'src/scoreBoard.js',
      ])
      .pipe(concat('source.js'))
      // .pipe(babel())
      .pipe(gulp.dest('.'));
});

gulp.task('uglify-src', function (cb) {
   let tfx = 'node /Users/posiwid/Development/Projects/node/AiP/v3/node_modules/babili/bin/babili.js source.js > minimized/source.min.js';
   exec(tfx, function (err, stdout, stderr) { cb(err); });
})

gulp.task('copy-src', function() {
	return gulp.src([ 'minimized/*.js', ])
		.pipe(header(banner))
		.pipe(gulp.dest(pkg.destination));
});

gulp.task('compress-html', function() {
  return gulp.src('production.html')
    .pipe(htmlmin({collapseWhitespace: true}))
    .pipe(rename('index.html'))
    .pipe(gulp.dest(pkg.destination));
});

gulp.task('copy-css-img', function() {
   return gulp.src(['./css/img/*'])
      .pipe(gulp.dest(pkg.destination + '/css/img'));
});

gulp.task('copy-icons', function() {
   return gulp.src(['./icons/*'])
      .pipe(gulp.dest(pkg.destination + '/icons'));
});

gulp.task('copy-fonts', function() {
   return gulp.src(['./fonts/*'])
      .pipe(gulp.dest(pkg.destination + '/fonts'));
});

gulp.task('copy-assets', function() {
   return gulp.src(['./assets/**/*'])
      .pipe(gulp.dest(pkg.destination + '/assets'));
});

gulp.task('copy-images', gulp.parallel('copy-css-img', 'copy-icons'));
gulp.task('copy-other', gulp.parallel('copy-fonts', 'copy-assets'));
gulp.task('copy', gulp.parallel('copy-images', 'copy-other'));
gulp.task('resources', gulp.parallel('concat-lib', 'copy'));
gulp.task('css', gulp.series('compress-css', 'concat-css'));
gulp.task('src', gulp.series('concat-idioms', 'concat-src'));
gulp.task('big-concat', gulp.series('src', 'uglify-src'));
gulp.task('source', gulp.series('big-concat', 'copy-src'));
gulp.task('html', gulp.parallel('css', 'compress-html'));
gulp.task('code', gulp.parallel('source', 'copy-manifest'));

gulp.task('default', gulp.parallel('code', gulp.parallel('resources', 'html')));


