
importScripts("ifsLib.js");

var FUNC_COUNT = 50;

var targetImage = null;
var baseIfs = null;
var shouldStop = true;
var population = null;
var popSize = 500;
var bestFitness = 0;

self.onmessage = function(e) {
    var parts = e.data.split(" ", 2);
    var command = parts[0];
    var param = parts[1];
    
    switch (command) {
        case "setTarget":
            targetImage = parseImage(param);
            log("got new target");
            initPopulation();
            break;
            
        case "setBase":
            baseIfs = parseIfs(param);
            log("got new base ifs");
            break;
            
        case "start":
            shouldStop = false;
            log("starting worker");
            doRun();
            break;
            
        default:
            log("unknown command \"" + command + "\"");
    }
}

function sortEvaluated(evaluated) {
    evaluated.sort(function (i1, i2) {
        return i2.fitness - i1.fitness;
    });
}

function doRun() {
    var generation = 0;
    
    while (true) {
        reportStats(population, generation);
        oneGeneration();
        generation++;
    }
}

function oneGeneration() {
    var bestFit = population[0].fitness;
    
    /* breed new individuals */
    
    var offspring = new Array();
    for (var i=0; i < popSize / 5; i++) {
        var parent = population[i].ifs.clone();
        parent.mutate(0.2);
        offspring.push(parent);
    }
    
    for (i=0; i < popSize / 5; i++) {
        var oidx = Math.floor(Math.random() * popSize);
        var other = population[oidx].ifs;
        var me = population[i].ifs;
        offspring.push(me.crossover(other));
    }
    
    /* evaluate offspring */
    
    var evalOff = new Array();
    for (i=0; i < offspring.length; i++) {
        var ifs = offspring[i];
        evalOff.push(evalIfs(ifs));
    }
    
    var all = evalOff.concat(population);
    sortEvaluated(all);
    
    population = all.slice(0, popSize);
    
    var newBest = population[0].fitness;
    if (newBest < bestFit) {
        throw "internal error (" + bestFit + " > " + newBest + ")";
    }
}

function initPopulation() {
    log("initializing " + popSize + " individuals");
    
    population = new Array();
    
    for (var i=0; i < popSize; i++) {
        population.push(evalIfs(randomIfs(FUNC_COUNT)));
    }
    
    sortEvaluated(population);
}

/**
 * an evalutated ifs
 */
function Evaluated(ifs, fitness) {
    this.ifs = ifs;
    this.fitness = fitness;
}

function evalIfs(ifs) {
    var img = new Image(targetImage.width, targetImage.height);
    ifs.draw(img);
    var fit = img.similarity(targetImage);
    
    if (fit > bestFitness) {
        bestIfs = ifs.clone();
        bestFitness = fit;
        reportImprovement(img);
        reportBestIfs(bestIfs);
    } else {
        reportProgress(img);
    }
    
    return new Evaluated(ifs, fit);
}

function reportStats(pop, gen) {
    var sum = 0;
    
    for (var i=0; i < pop.length; i++) {
        sum += pop[i].fitness;
    }
    
    var min = pop[pop.length-1].fitness;
    var avg = sum / pop.length;
    var max = pop[0].fitness;
    
    self.postMessage(
        "stats " + gen + "#" + min + '#' + avg + "#" + max);
}

function reportBestIfs(ifs) {
    self.postMessage("bestIfs " + ifs.serialize());
}

function reportImprovement(img) {
    self.postMessage("improved " + img.serialize());
}

function reportProgress(image) {
    self.postMessage("progress " + image.serialize());
}

function log(message) {
    self.postMessage("log " + message);
}
