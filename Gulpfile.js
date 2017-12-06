var gulp = require('gulp');
var sass = require('gulp-sass');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var nodemon = require('gulp-nodemon');

var sassSrc = 'app/assets/scss/*.scss'
var jsSrc = 'app/assets/js/*.js'
var imgSrc = 'app/assets/images/**.*'

gulp.task('sass', function() {
  return gulp.src(sassSrc)
    .pipe(sass({
      includePaths: 'node_modules/govuk_frontend_toolkit/stylesheets'
    }))
    .pipe(gulp.dest('public/css'))
});

gulp.task('js', function() {
  return gulp.src(jsSrc)
    .pipe(concat('main.js', {
      newLine:'\n;' // the newline is needed in case the file ends with a line comment, the semi-colon is needed if the last statement wasn't terminated
    }))
    .pipe(uglify())
    .pipe(gulp.dest('public/js'))
});

gulp.task('img', function() {
  return gulp.src(imgSrc)
    .pipe(gulp.dest('public/images'));
});

gulp.task('generate-assets', ['sass', 'js', 'img']);

gulp.task('watch', function() {
  gulp.watch(sassSrc, ['sass']);
  gulp.watch(jsSrc, ['js']);
  gulp.watch(imgSrc, ['img']);
});

gulp.task('serve', function () {
  gulp.run('watch');
  var stream = nodemon({
    script: 'server.js',
    ext: 'js',
    ignore: ['app']
  })
  stream
    .on('restart', function () {
      console.log('restarted!')
    })
    .on('crash', function() {
      console.error('Application has crashed!\n')
      stream.emit('restart', 10)  // restart the server in 10 seconds
    })
});
