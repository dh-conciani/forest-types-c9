// classify types of forest 
// dhemerson.costa@ipam.org.br

// version
var version = '1';

// set thrshold (hand in meters, equal or less than) 
var thrs = 5;

// set dirout
var dirout = 'projects/mapbiomas-workspace/COLECAO_DEV/COLECAO9_DEV/CERRADO/FOREST_TYPE/'

// set years
var years = ee.List.sequence({'start': 1985, 'end': 2023}).getInfo();

// read biome
var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster');

// read mapbiomas collecction
var collection = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1')
  .updateMask(biomes.eq(4));

// read hand
var hand = ee.ImageCollection('users/gena/global-hand/hand-100')
  .mosaic()
  .updateMask(biomes.eq(4));

// for each year, retain forests
var recipe = ee.Image([]);
years.forEach(function(year_i) {
  // get year i
  var collection_i = collection.select('classification_' + year_i);
  // classify forests
  var forests_i= ee.Image(0).where(collection_i.eq(3).and(hand.lte(thrs)), 1)
                         .where(collection_i.eq(3).and(hand.gt(thrs)), 2)
                         .selfMask();
  
  //store
  recipe = recipe.addBands(forests_i.rename('classification_' + year_i));
});


// plot
Map.addLayer(hand, {}, 'hand', false);
Map.addLayer(recipe.select('classification_2023'), {palette:['red', 'green'], min:1, max:2}, 'forests 2023');

 // export to workspace asset
Export.image.toAsset({
    "image": recipe.toInt8(),
    "description": 'cerrado_forests_v' + version + '_t' + thrs,
    "assetId": dirout + 'cerrado_forests_v' + version + '_t' + thrs,
    "scale": 30,
    "pyramidingPolicy": {
        '.default': 'mode'
    },
    "maxPixels": 1e13,
    "region": collection.geometry()
});  
