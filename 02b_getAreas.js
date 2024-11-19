// export area

// define years to be computed 
var years = ee.List.sequence({'start': 1985, 'end': 2023}).getInfo();

// thrs
var version = 1;
var thrs = 5;

// read water surface
var asset_water = 'projects/mapbiomas-workspace/COLECAO_DEV/COLECAO9_DEV/CERRADO/FOREST_TYPE/cerrado_forests_v' + version + '_t' +thrs;
var asset_raster_biomas = 'projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41';
var asset_bioma_shp = 'projects/mapbiomas-workspace/AUXILIAR/biomas_IBGE_250mil';
var asset_estados_raster = 'projects/mapbiomas-workspace/AUXILIAR/estados-2016-raster';
var asset_estados_shp = 'projects/mapbiomas-workspace/AUXILIAR/estados-2016';
/// https://code.earthengine.google.com/938f31ff27475eb4083d4b961053a1dd /// 
var lst_estados = [17,21,22,25,31,35,41,50,51,52,53];
var collection = ee.Image(asset_water);
var territory = ee.Image(asset_estados_raster).rename('territory');
var estadosSHP = ee.FeatureCollection(asset_estados_shp);
var biomashp = ee.FeatureCollection(asset_bioma_shp)
                      .filter(ee.Filter.eq('CD_Bioma', 3)).geometry(); // Cerrado
var biomas_raster = ee.Image(asset_raster_biomas).eq(4);  // Cerrado
// Image area in hectares
var pixelArea = ee.Image.pixelArea().divide(10000).updateMask(biomas_raster);


// rasterize
Map.addLayer(territory.randomVisualizer(), {}, 'territories');
Map.addLayer(collection.select(37).randomVisualizer(), {}, 'data sample - 2022')
Map.addLayer(biomashp, {color: 'yellow'}, 'limit Cerrado');
// change the scale if you need.
var scale = 30;

// define a Google Drive output folder 
var driverFolder = 'FOREST-TYPE';

// get the classification for the file[i] 
var asset_i = collection.selfMask();

// convert a complex object to a simple feature collection 
var convert2table = function (obj) {
            obj = ee.Dictionary(obj);
            return ee.Feature(null)
                .set('class_id', obj.get('class'))
                .set('area', obj.get('sum'))
                .set('version', version)
                .set('thrs', thrs)
};

// compute the area
var calculateArea = function (image, rasterRegArea, geometry) {
    var areaClassesData = ee.Image(rasterRegArea).addBands(image)
                              .reduceRegion({
                                  reducer: ee.Reducer.sum().group(1, 'class'),
                                  geometry: ee.Geometry(geometry),
                                  scale: scale,
                                  maxPixels: 1e13
                              });
    var areaClasseslst = ee.List(areaClassesData.get('groups'));
    var areas = ee.List(areaClasseslst).map(convert2table);
    return ee.FeatureCollection(areas);
};
 var areas_g = ee.FeatureCollection([]);
// perform per year 
lst_estados.forEach(
    function(id_est){
          print("estado = " + id_est);
          var estadoMask = territory.eq(ee.Number(id_est));
          var geoEstado = estadosSHP.filter(ee.Filter.eq('CD_GEOCUF', String(id_est))).geometry();
          var geo_estado_bioma = geoEstado.intersection(biomashp);
          var mapRaster = asset_i.updateMask(estadoMask);
          var baseArea = pixelArea.updateMask(estadoMask);
          var areasYY  = years.map(
                function (year) {
                    // var year = 2014;
                    var image = mapRaster.select('classification_' + year);
                    // print(image)
                    var areas = calculateArea(image, baseArea, geo_estado_bioma);
                    // set additional properties
                    areas = areas.map(
                        function (feature) {
                            return feature.set('year', year);
                        }
                    );
                    return areas;
                }
            );
          areasYY = areasYY.map(function(feat){return feat.set('territory', id_est)});
          areas_g = areas_g.merge(areasYY);
    }
);
print("Todas as áreas agrupadas por estado e biomas ", areas_g);
areas_g = ee.FeatureCollection(areas_g);
  
Export.table.toDrive({
    collection: areas_g,
    description: 'forest-type_v' + version + '_t' + thrs,
    folder: driverFolder,
    fileFormat: 'CSV'
});
