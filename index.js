const pg = require('pg-promise')()
const Bacon = require('baconjs')

module.exports = function (app) {
  function start(options, restartPlugin) {
    app.debug('PostGIS export plugin started')

    const pgConnectionURL = `postgres://${options.user}:${options.password}@localhost:5432/${options.database}`
    const db = pg(pgConnectionURL)

    const position = app.streambundle.getSelfStream('navigation.position')
    const speed = app.streambundle.getSelfStream('navigation.speedOverGround')
    const course = app.streambundle.getSelfStream('navigation.courseOverGroundTrue')
    const rpm = app.streambundle.getSelfStream('traktoripi.sensor.rpm')

    const trackData = Bacon.combineTemplate({position, speed, course, rpm})
      .skipDuplicates(({position: oldPos}, {position: newPos}) => oldPos.latitude === newPos.latitude && oldPos.longitude === newPos.longitude)

      trackData.onValue(async data => {
        try {
          const result = await db.any(`
            INSERT INTO tracks (point, created_at, speed, course, data)
            VALUES ('POINT($1 $2)', now(), $3, $4,$5)`,
            [data.position.longitude, data.position.latitude, data.speed, data.course, {rpm: data.rpm}])
        } catch(e) {
          console.error(`Error writing into postgre`, e)
        }
      })
  }

  function stop() {
    app.debug('Plugin stopped')
  }

  return {
    id: 'traktoripi-sk-postgis-export',
    name: 'SignalK PostGIS export',
    start,
    stop,
    schema: {
      type: 'object',
      required: ['user', 'password', 'database'],
      properties: {
        user: {
          type: 'string',
          title: 'Postgres user',
          default: 'agriuser'
        },
        password: {
          type: 'string',
          title: 'Postgres password',
          default: 'agriuser'
        },
        database: {
          type: 'string',
          title: 'Database',
          default: 'agri'
        }
      }
    }
  }
}