// export area

// define years to be computed 
var years = ee.List.sequence({'start': 1985, 'end': 2023}).getInfo();

// thrs
var version = 1;
var thrs = 5;

// read water surface
var collection = ee.Image('projects/mapbiomas-workspace/COLECAO_DEV/COLECAO9_DEV/CERRADO/FOREST_TYPE/cerrado_forests_v' + version + '_t' +thrs);
  
var territory = ee.Image('projects/mapbiomas-workspace/AUXILIAR/estados-2016-raster').rename('territory')
  // create numerical ids
//  .map(function(feature) {
//    return (feature.set({'ID': ee.Number.parse(feature.get('ID'))}));
//  });

// rasterize
Map.addLayer(territory.randomVisualizer(), {}, 'territories');
Map.addLayer(collection.select(37).randomVisualizer(), {}, 'data sample - 2022')

// change the scale if you need.
var scale = 30;

// define a Google Drive output folder 
var driverFolder = 'FOREST-TYPE';

// get the classification for the file[i] 
var asset_i = collection.selfMask();

// Image area in hectares
var pixelArea = ee.Image.pixelArea().divide(10000);

// Geometry to export
var geometry = ee.FeatureCollection('projects/mapbiomas-workspace/AUXILIAR/biomas-2019')
  .filterMetadata('Bioma', 'equals', 'Cerrado')
  .geometry();
  
//Map.addLayer(geometry, {}, '.geo')

// convert a complex object to a simple feature collection 
var convert2table = function (obj) {
  obj = ee.Dictionary(obj);
    var territory = obj.get('territory');
    var classesAndAreas = ee.List(obj.get('groups'));
    
    var tableRows = classesAndAreas.map(
        function (classAndArea) {
            classAndArea = ee.Dictionary(classAndArea);
            var classId = classAndArea.get('class');
            var area = classAndArea.get('sum');
            var tableColumns = ee.Feature(null)
                .set('territory', territory)
                .set('class_id', classId)
                .set('area', area)
                .set('version', version)
                .set('thrs', thrs)
                
            return tableColumns;
        }
    );
  
    return ee.FeatureCollection(ee.List(tableRows));
};

// compute the area
var calculateArea = function (image, territory, geometry) {
    var territotiesData = pixelArea.addBands(territory).addBands(image)
        .reduceRegion({
            reducer: ee.Reducer.sum().group(1, 'class').group(1, 'territory'),
            geometry: geometry,
            scale: scale,
            maxPixels: 1e13
        });
        
    territotiesData = ee.List(territotiesData.get('groups'));
    var areas = territotiesData.map(convert2table);
    areas = ee.FeatureCollection(areas).flatten();
    return areas;
};
 
// perform per year 
var areas = years.map(
    function (year) {
        var image = asset_i.select('classification_' + year);
        var areas = calculateArea(image, territory, geometry);
        // set additional properties
        areas = areas.map(
            function (feature) {
                return feature.set('year', year);
            }
        );
        return areas;
    }
);

areas = ee.FeatureCollection(areas).flatten();
  
Export.table.toDrive({
    collection: areas,
    description: 'forest-type_v' + version + '_t' + thrs,
    folder: driverFolder,
    fileFormat: 'CSV'
});
