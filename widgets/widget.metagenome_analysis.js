(function () {
    var widget = Retina.Widget.extend({
        about: {
                title: "Metagenome Analysis Widget",
                name: "metagenome_analysis",
                author: "Tobias Paczian",
            requires: [ "rgbcolor.js", "html2canvas.js", "jszip.min.js", "numeric.min.js" ]
        }
    });
    
    // load all required widgets and renderers
    widget.setup = function () {
	return [ Retina.load_widget({"name": "RendererController", "resource": "Retina/widgets/"}),
		 Retina.load_renderer('table'),
		 Retina.load_renderer('svg2'),
		 Retina.load_renderer('listselect')
	       ];
    };

    widget.taxLevels = [ "domain", "phylum", "className", "order", "family", "genus", "species" ];//, "strain" ];
    widget.ontLevels = { "Subsystems": ["level1","level2","level3","function"], "KO": ["level1","level2","level3","function"], "COG": ["level1","level2","function"], "NOG": ["level1","level2","function"] };
    widget.sources = { "taxonomy": ["RefSeq"], "RNA": ["RDP", "Silva LSU", "Silva SSU", "ITS", "Greengenes"], "hierarchical": ["Subsystems","KO","COG","NOG"] };
    widget.sourcesNameMapping = { "Silva SSU": "SSU", "Silva LSU": "LSU" };
    widget.sourceType = { "OTU": "taxonomy", "RefSeq": "taxonomy", "IMG": "taxonomy", "TrEMBL": "taxonomy", "SEED": "taxonomy", "KEGG": "taxonomy", "GenBank": "taxonomy", "SwissProt": "taxonomy", "PATRIC": "taxonomy", "eggNOG": "taxonomy", "RDP": "taxonomy", "Silva LSU": "taxonomy", "Silva SSU": "taxonomy", "SSU": "taxonomy", "LSU": "taxonomy", "ITS": "taxonomy", "Greengenes": "taxonomy", "Subsystems": "function","KO": "function","COG": "function","NOG": "function" };
    widget.filterlists = {};

    widget.cutoffThresholds = {
	"evalue": 5,
	"identity": 60,
	"alilength": 15
    };

    widget.graphs = {};

    widget.context = "none";
    widget.currentType = "barchart";
    
    // main display function called at startup
    widget.display = function (params) {
	widget = this;
        var index = widget.index;

	// set callback for profile manager
	if (Retina.WidgetInstances.profileManager && Retina.WidgetInstances.profileManager.length == 2) {
	    Retina.WidgetInstances.profileManager[1].callback = Retina.WidgetInstances.metagenome_analysis[1].enableLoadedProfiles;
	}
	
	jQuery.extend(widget, params);

	// initialize data storage
	if (! stm.DataStore.hasOwnProperty('metagenome')) {
	    stm.DataStore.metagenome = {};
	}
	if (! stm.DataStore.hasOwnProperty('profile')) {
	    stm.DataStore.profile = {};
	}

	// set page title
	document.getElementById("pageTitle").innerHTML = "analysis";

	// check for user / collections
	if (stm.user) {
	    stm.loadPreferences().then(function(){
		Retina.WidgetInstances.metagenome_analysis[1].enableCollections();
	    });
	}
	
	// set the output area
	if (! stm.DataStore.hasOwnProperty('taxonomy')) {
	    widget.main.innerHTML = '<div id="data">checking local storage... <img src="Retina/images/waiting.gif" style="width: 16px;"></div><div id="visualize"></div>';
	    stm.readHardStorage("analysis").then( function () {
		var widget = Retina.WidgetInstances.metagenome_analysis[1];
		if (stm.DataStore.hasOwnProperty('taxonomy')) {
		    widget.display();
		} else {
		    widget.main.innerHTML = '<div id="data">loading taxonomy data... <img src="Retina/images/waiting.gif" style="width: 16px;"></div><div id="visualize"></div>';
		    widget.loadBackgroundData();
		    return;
		}
	    });
	    return;
	}

	// set the tool area
	var tools = widget.sidebar;
	tools.parentNode.style.overflowY = "visible";
	tools.setAttribute('style', 'padding: 10px; overflow-x: auto;');

	// check the context
	var toolshtml = "";
	if (Retina.cgiParam('recipe')) {
	    widget.isRecipe = true;

	    if (! widget.recipe) {
		jQuery.getJSON('data/recipes/recipe'+Retina.cgiParam('recipe')+'.recipe.json', function (data) {
		    var widget = Retina.WidgetInstances.metagenome_analysis[1];
		    widget.recipe = data;
		    widget.display();
		});
		return;
	    }
	    
	    toolshtml += "<div id='recipeDisplay' style='border-radius: 5px;'></div>";
	} else {
	    toolshtml += "<h4>Analysis</h4>";
	    toolshtml += "<div id='availableContainers'></div>";
	}
	toolshtml += "<hr style='clear: both; margin-top: 15px; margin-bottom: 5px;'>";
	toolshtml += "<div id='recipeShowMoreOptions' style='display: none; text-align: center;'><button class='btn' onclick='document.getElementById(\"recipeShowMoreOptions\").style.display=\"none\";document.getElementById(\"containerActive\").style.display=\"\";'>show all options</button></div><div id='containerActive' style='display: none;'><div id='currentContainerParams'></div>";

	toolshtml += '<ul class="nav nav-tabs" id="toolsTab">';
	toolshtml += '<li class="active"><a href="#visualContainerSpace">View</a></li>';
	toolshtml += '<li><a href="#toolsContainerSpace">Metadata</a></li>';
	toolshtml += '<li><a href="#pluginContainerSpace">Plugins</a></li>';
	toolshtml += '<li><a href="#exportContainerSpace">Export</a></li>';
	toolshtml += '</ul>';

	toolshtml += '<div class="tab-content">';
	toolshtml += '<div class="tab-pane active" id="visualContainerSpace" style="padding: 0px;"></div>';
	toolshtml += '<div class="tab-pane" id="pluginContainerSpace" style="padding: 0px;"></div>';
	toolshtml += '<div class="tab-pane" id="exportContainerSpace" style="padding: 0px;"></div>';
	toolshtml += '<div class="tab-pane" id="toolsContainerSpace" style="padding: 0px;"></div>';
	toolshtml += '</div>';

	toolshtml += '</div>';
	
	tools.innerHTML = toolshtml;

	jQuery('#toolsTab a').click(function (e) {
	    e.preventDefault();
	    jQuery(this).tab('show');
	});

	widget.showDataContainers();
	widget.fillVisualizations();
	widget.fillExport();
	widget.fillTools();
	widget.fillPlugins();

	widget.loadDataUI();

	widget.loadGraphs();

	widget.graph = Retina.Renderer.create("svg2", {});

	// add recipe editor modal
	var recipeDiv = document.createElement('div');
	recipeDiv.setAttribute('class', 'modal hide fade');
	recipeDiv.setAttribute('aria-hidden', "true");
	recipeDiv.setAttribute('id', 'recipeModal');
	recipeDiv.setAttribute('tabindex', "-1");
	recipeDiv.setAttribute('role', "dialog");
	recipeDiv.innerHTML = '<div class="modal-header"><button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button><h3>Create a new recipe</h3></div><div class="modal-body" id="recipeModalContent" style="max-height: 550px;"></div><div class="modal-footer"><a href="#" class="btn btn-danger pull-left" data-dismiss="modal" aria-hidden="true">cancel</a><a href="#" class="btn" onclick="Retina.WidgetInstances.metagenome_analysis[1].createRecipe(true);"><img src="Retina/images/cloud-download.png" style="width: 16px; margin-right: 5px;"> download recipe</a><a href="#" class="btn" onclick="Retina.WidgetInstances.metagenome_analysis[1].createRecipe(false);"><img src="Retina/images/cloud-upload.png" style="width: 16px; margin-right: 5px;"> upload recipe to myData</a></div></div>';
	document.body.appendChild(recipeDiv);

	if (widget.isRecipe) {
	    Retina.WidgetInstances.metagenome_analysis[1].showRecipe(widget.recipe);
	}
    };

    /*
      PAGE SETUP
     */

    // fill the export options
    widget.fillExport = function () {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];

    	var container = document.getElementById('exportContainerSpace');
	var html = "";

	html += "<div style='float: left;'><img src='Retina/images/file-xml.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].exportData(\"svg\");' title='scalable vector graphic'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>SVG</div></div>";
	html += "<div style='float: left;'><img src='Retina/images/image.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].exportData(\"png\");' title='portable network graphic'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>PNG</div></div>";
	html += "<div style='float: left;'><img src='Retina/images/table.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].exportData(\"tsv\");' title='tab separated data'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>TSV</div></div>";
	html += "<div style='float: left;'><img src='Retina/images/table.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].exportData(\"tsv_aeap\");' title='tab separated data with abundance, e-value, alignment length and percent identity'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>TSV detailed</div></div>";
	html += "<div style='float: left;'><img src='Retina/images/file-biom.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].exportData(\"biom\");' title='one biom file per dataset with abundance and e-value'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>biom</div></div>";
	html += "<div style='float: left;'><img src='Retina/images/file-biom.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].exportData(\"biom_abu\");' title='biom file containing all datasets and abundance only'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>biom hits only</div></div>";
	html += "<div style='float: left;'><img src='Retina/images/file-fasta.png' class='tool' onclick='if(confirm(\"Download annotated reads as FASTA?\")){Retina.WidgetInstances.metagenome_analysis[1].downloadFASTA();}' title='download annotated reads as FASTA'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>FASTA</div></div>";


	container.innerHTML = html;
    };

    widget.fillTools = function () {
	var container = document.getElementById('toolsContainerSpace');
	var html = "";

	/*
	  This is functional but not yet intended for public use
	 */
	//html += "<div style='float: left;'><img src='Retina/images/cloud-upload.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].exportData(\"shock\");' title='upload to myData in MG-RAST' id='uploadButton'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>myData</div></div>";
    	html += "<div style='float: left;'><img src='Retina/images/notebook.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].showMetadata();' title='show / edit metadata'<br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>metadata</div></div>";

	container.innerHTML = html;
    };

    widget.fillPlugins = function () {
	var widget = this;

	var container = document.getElementById('pluginContainerSpace');

	var html = "";

	html += "<div style='float: left;'><img src='Retina/images/krona.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].plugin(\"krona\");' title='krona'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>Krona</div></div>";
	html += "<div style='float: left;'><img src='images/kegg.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].plugin(\"kegg\");' title='KEGG Mapper'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>KEGGmap</div></div>";
	html += "<div style='float: left;'><img src='images/cytoscape_logo.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].plugin(\"cytoscape\");' title='Cytoscape'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>Cytoscape</div></div>";
	/*
	  This has been commented out and should be put back in when the list generator has been fully implemented
	 */
	//	html += "<div style='float: left;'><img src='Retina/images/table.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].plugin(\"listmaker\");' title='List Generator'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>ListGen</div></div>";

	container.innerHTML = html;
    };

    // visualization section
    widget.fillVisualizations = function () {
    	var widget = Retina.WidgetInstances.metagenome_analysis[1];

    	var container = document.getElementById('visualContainerSpace');

    	var html = "";
    	html += "<div style='float: left;'><img src='Retina/images/table.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"table\");' title='table'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>table</div></div>";
    	html += "<div style='float: left;'><img src='Retina/images/matrix.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"matrix\");' title='matrix'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>matrix</div></div>";

    	html += "<div style='float: left;'><img src='Retina/images/pie.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"piechart\");' title='piechart'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>pie-chart</div></div>";
    	html += "<div style='float: left;'><img src='Retina/images/donut.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"donutchart\");' title='donutchart'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>donut-chart</div></div>";
	html += "<div style='float: left;'><img src='Retina/images/rarefaction.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"rarefaction\");' title='rarefaction plot'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>rarefaction</div></div>";
    	html += "<div style='float: left;'><img src='Retina/images/barchart.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"barchart2\");' title='grouped barchart'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>barchart</div></div>";
    	html += "<div style='float: left;'><img src='Retina/images/stackedbarchart.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"barchart\");' title='stacked barchart'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>stacked bar</div></div>";

	html += "<div style='float: left;'><img src='Retina/images/scatterplot.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"pca\");' title='PCoA'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>PCoA</div></div>";
	html += "<div style='float: left;'><img src='images/icon_heatmap.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"heatmap\");' title='heatmap'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>heatmap</div></div>";
	html += "<div style='float: left;'><img src='Retina/images/differential.png' class='tool' onclick='Retina.WidgetInstances.metagenome_analysis[1].visualize(\"differential\");' title='differential coverage'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>differential</div></div>";
	
    	container.innerHTML = html;
    };

    /*
      VISUALIZATION MANAGEMENT
    */

    // draw the selected visualization
    widget.visualize = function (type) {
    	var widget = Retina.WidgetInstances.metagenome_analysis[1];

	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	type = type || c.currentRendererType || widget.currentType;
    	c.currentRendererType = widget.currentType = type;
	if (! c.visualization.hasOwnProperty(type)) {
	    c.visualization[type] = {};
	}
	
    	document.getElementById("data").style.display = "none";
    	document.getElementById("visualize").style.display = "";

    	var container = document.getElementById('visualize');

    	if (type == "container") {
    	    widget.showCurrentContainerParams();
    	    return;
    	}

    	var visMap = widget.visualizationMapping();
	
    	var html = "<div id='visualizeTarget'></div>";

    	container.innerHTML = html;

	// get the target div
    	visMap[type].settings.target = document.getElementById('visualizeTarget');

	// reset the renderer instance
    	if (Retina.RendererInstances[visMap[type].renderer]) {
    	    Retina.RendererInstances[visMap[type].renderer] = [ jQuery.extend(true, {}, Retina.RendererInstances[visMap[type].renderer][0]) ];
    	}

	// reset the renderer controller instance
    	if (Retina.WidgetInstances.RendererController) {
    	    Retina.WidgetInstances.RendererController = [ jQuery.extend(true, {}, Retina.WidgetInstances.RendererController[0]) ];
    	}
	
	// get the settings
	var settings = jQuery.extend(true, {}, visMap[type].settings, c.visualization[type]);
	jQuery.extend(true, c.visualization[type], settings);

	// set the data
	settings.data = visMap[type].hasOwnProperty('dataConversion') ? widget[visMap[type].dataConversion](visMap[type].dataField) : jQuery.extend(true, {}, stm.DataStore.dataContainer[widget.selectedContainer].matrix);

	// check if we need to adjust the control groups
	var requireDataUpdate = false;
	var groups = visMap[type].controlGroups;
	var dataUpdaters = [];
	for (var i=0; i<groups.length; i++) {
	    var k = Retina.keys(groups[i])[0];
	    for (var h=0; h<groups[i][k].length; h++) {
		var item = groups[i][k][h];

		// create default settings, if no other settings are present
		if (settings.hasOwnProperty(item.name)) {
		    if (item.hasOwnProperty('default')) {
			item['default'] = c.visualization[type][item.name];
		    } else if (item.hasOwnProperty('defaultTrue')) {
			item['defaultTrue'] = c.visualization[type][item.name];
		    }
		} else {
		    if (item.hasOwnProperty('default')) {
			c.visualization[type][item.name] = settings[item.name] = item['default'];
		    } else if (item.hasOwnProperty('defaultTrue')) {
			c.visualization[type][item.name] = settings[item.name] = item['defaultTrue'];
		    }
		}
		
		// check if this is a data updater
		if (item.isDataUpdater) {
		    dataUpdaters.push(item);
		    requireDataUpdate = true;
		}

		// check if the control item needs to adapt to the sample data
		if (item.adaptToData) {
		    var opts = [];
		    if (item.values && item.values == "metadata") {

			// parse the metadata into the required structure
			var g = [ "mixs", "project", "env_package", "library", "sample" ];
			var allMD = { "mixs": {}, "project": {}, "env_package": {}, "library": {}, "sample": {} };
			var allMDdiff = { "mixs": {}, "project": {}, "env_package": {}, "library": {}, "sample": {} };
			for (var l=0; l<c.items.length; l++) {
			    for (var j=0; j<g.length; j++) {
				var p = stm.DataStore.profile[c.items[l].id];
				if (! p) {
				    p = stm.DataStore.otuprofile[c.items[l].id];
				}
				if (p && p.metagenome && p.metagenome.metadata) {
				    var d = p.metagenome.metadata.hasOwnProperty(g[j]) ? p.metagenome.metadata[g[j]].data : {};
				    var mds = Retina.keys(d);
				    for (var m=0; m<mds.length; m++) {
					if (! allMD[g[j]].hasOwnProperty(mds[m])) {
					    allMD[g[j]][mds[m]] = 0;
					    allMDdiff[g[j]][mds[m]] = {};
					}
					allMD[g[j]][mds[m]]++;
					allMDdiff[g[j]][mds[m]][d[mds[m]]] = true;
				    }
				}
			    }
			}

			// iterate over the metadata and create options
			for (var j=0; j<g.length; j++) {
			    opts.push( { "isGroup": true, "name": g[j] } );
			    var mds = Retina.keys(allMD[g[j]]).sort();
			    for (var l=0; l<mds.length; l++) {
				var percent = parseInt(allMD[g[j]][mds[l]] / c.items.length * 100);
				if (percent < 100) {
				    percent = " ("+percent+"%)";
				} else {
				    percent = "";
				}
				var val = g[j]+"|"+mds[l];
				var opt = { "label": mds[l].replace(/_/g, " ")+percent, "value": val };
				if (item.hasOwnProperty('default') && (item["default"] == val)) {
				    opt.selected = true;
				}
				if (Retina.keys(allMDdiff[g[j]][mds[l]]).length > 1) {
				    opts.push(opt);
				}
			    }
			}
		    } else {
			for (var j=0; j<c.items.length; j++) {
			    var opt = {};
			    if (item.values && item.values == "counter") {
				opt.label = j + 1;
				opt.value = j;
			    } else if (item.values) {
				opt = jQuery.extend(true, {}, c.items[j][item.values]);
			    } else { 
				opt.value = j;
				opt.label = c.items[j].name;
			    }
			    if ((settings.hasOwnProperty(item.name) && settings[item.name] == j) || (item.hasOwnProperty('default') && item['default'] == opt.value)) {
				opt.selected = true;
			    } else {
				opt.selected = false;
			    }
			    opts.push(opt);
			}
		    }
		    item.options = opts;
		}
	    }
	}

	// perform the data callback if needed
	if (requireDataUpdate && ! visMap[type].hasOwnProperty('dataField')) {
	    settings = widget.dataCallback({"dataUpdaters": dataUpdaters, "settings": settings});
	}

	// set the callback
	settings.callback = widget.graphCallback;

	// set the title
	settings.title = visMap[type].title+" of " + (widget.selectedContainer ? widget.selectedContainer : "demonstration analysis");

	// set the current controller
    	widget.currentVisualizationController = Retina.Widget.create('RendererController', { "target": document.getElementById("visualizeTarget"), "type": visMap[type].renderer, "settings": settings, "controls": groups, "showBreadcrumbs": true, "breadcrumbs": c.breadcrumbs || "", "dataCallback": widget.dataCallback, "settingsCallback": widget.settingsCallback, "renderCallback": type == 'table' ? widget.visualize : null });
    };

    // adjust renderer settings
    widget.settingsCallback = function (name, value) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];
	
	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	var ind;
	if (name.match(/^items\[/)) {
	    var ret = name.match(/^items\[(\d+)\]\.parameters\.(.+)/);
	    ind = ret[1];
	    name = ret[2];
	} else if (name.match(/^\d/)) {
	    ind = parseInt(name.match(/^\d+/)[0]);
	    name = name.match(/\D+/)[0];
	} else {
	    c.visualization[c.currentRendererType][name] = value;
	    return;
	}
	
	c.visualization[c.currentRendererType].items[ind].parameters[name] = value;
    };

    // adjust the data for visualization
    widget.dataCallback = function (rc) {
	var settings = rc.hasOwnProperty('renderer') ? rc.renderer.settings : rc.settings;

	var widget = Retina.WidgetInstances.metagenome_analysis[1];
	var c = stm.DataStore.dataContainer[widget.selectedContainer];

	// check what kind of data operation is requested
	var data = jQuery.extend(true, {}, c.matrix);

	var visMap = widget.visualizationMapping()[widget.currentType];

	if (visMap.hasOwnProperty('dataField')) {
	    return;
	}
	
	// iterate over all data attributes
	for (var i=0; i<rc.dataUpdaters.length; i++) {
	    var opt = rc.dataUpdaters[i];
	    
	    // data normalization
	    if (opt.name == "normalize" && settings[opt.name]) {
		data.data = Retina.roundMatrix(Retina.transposeMatrix(Retina.normalizeMatrix(Retina.transposeMatrix(data.data))), 4);
	    }

	    // turn data to log
	    else if (opt.name == "log") {
		if (settings[opt.name]) {
		    data.data = Retina.roundMatrix(Retina.logMatrix(data.data), 3);
		    if (visMap.hasOwnProperty('logAxes')) {
			for (var h=0; h<visMap.logAxes.length; h++) {
			    settings.items[visMap.logAxes[h]].parameters.isLog = true;
			    settings.items[visMap.logAxes[h]].data += "log";
			}
		    }
		} else {
		    if (visMap.hasOwnProperty('logAxes')) {
			for (var h=0; h<visMap.logAxes.length; h++) {
			    settings.items[visMap.logAxes[h]].parameters.isLog = false;
			    settings.items[visMap.logAxes[h]].data = settings.items[visMap.logAxes[h]].data.replace(/log$/, '');
			}
		    }
		}
	    }

	    // set pca components
	    else if (opt.name == "pcaa" || opt.name == "pcab") {
		if (opt.name == "pcaa") {
		    c.parameters.pcaComponentA = settings[opt.name] || 0;
		} else {
		    c.parameters.pcaComponentB = settings.hasOwnProperty(opt.name) ? settings[opt.name] : 1;
		}
	    }

	    // set the differential plot metagenomes
	    else if (opt.name == "mga" || opt.name == "mgb") {
		if (opt.name == "mga") {
		    c.parameters.differentialMetagenomeA = settings[opt.name] || 0;
		} else {
		    c.parameters.differentialMetagenomeB = settings.hasOwnProperty(opt.name) ? settings[opt.name] : 1;
		}
	    }

	    // update the metadatum
	    else if (opt.name == "metadatum" && settings.hasOwnProperty('metadatum')) {
		c.parameters.metadatum = settings.metadatum;
		var x = settings.metadatum.split(/\|/);
		for (var h=0; h<data.cols.length; h++) {
		    var p = stm.DataStore.profile[c.items[h].id];
		    if (! p) {
			p = stm.DataStore.otuprofile[c.items[h].id];
		    }
		    data.cols[h] = p.metagenome.metadata.hasOwnProperty(x[0]) && p.metagenome.metadata[x[0]].data.hasOwnProperty(x[1]) ? p.metagenome.metadata[x[0]].data[x[1]] : "-";
		}
	    }
	}

	if (visMap.hasOwnProperty('dataConversion')) {
	    data = widget[visMap.dataConversion](data);
	}
	
	settings.data = data;
	
	return settings;
    };

    // a visualization was clicked to navigate
    widget.graphCallback = function (event) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];
	var rend = this.renderer;
	event = event || window.event;

	var cat;
	
	if (event.hasOwnProperty('cellValue') && event.colIndex == null) {
	    cat = event.cellValue;
	} else {
	
	    var t = event.target;
	    
	    if (t.nodeName == "text") {
		cat = t.innerHTML;
	    } else if (t.previousSibling && t.previousSibling.nodeName == "title") {
		cat = t.previousSibling.innerHTML.split(/ - /)[1];
	    } else {
		console.log('unhandled click element');
		console.log(t);
		return;
	    }
	}

	var dls = document.getElementById('displayLevelSelect');
	
	// check if we can zoom in
	if (dls.selectedIndex + 1 < dls.options.length) {
	    
	    // remove the filters for the current displayType
	    var c = stm.DataStore.dataContainer[widget.selectedContainer];
	    if (c.parameters.displayType == "taxonomy") {
		c.parameters.taxFilter = [ { "level": c.parameters.displayLevel, "source": c.parameters.displaySource, "value": cat } ];
	    } else {
		c.parameters.ontFilter = [ { "level": c.parameters.displayLevel, "source": c.parameters.displaySource, "value": cat } ];
	    }
	    dls.selectedIndex++;
	    dls.onchange();
	}
    };

    widget.setFilter = function (cat, level, source, type) {
	var widget = this;

	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	if (! c.hasOwnProperty('items')) {
	    alert('You must select data first!');
	    return;
	}
	level = level || c.parameters.displayLevel;
	source = source || c.parameters.displaySource
	type = type || 'tax';

	// set filter
	c.parameters[type+'Filter'] = [ { "level": level, "source": source, "value": cat } ];

	// recalculate matrix
	if (! widget.container2matrix()) { return; }
	
	// update breadcrumbs
	var bread = "<a href='#' onclick='Retina.WidgetInstances.metagenome_analysis[1].activateBreadcrumb(0);'>&raquo; all</a> ";
	var hier = c.hierarchy[Retina.keys(c.hierarchy)[0]];
	for (var h=0; h<hier.length - 1; h++) {
	    bread += "<a href='#' onclick='Retina.WidgetInstances.metagenome_analysis[1].activateBreadcrumb("+h+", \""+hier[h]+"\");'>&raquo; "+hier[h]+"</a> ";
	}
	c.breadcrumbs = bread;

	widget.showCurrentContainerParams();
	widget.visualize();
    };

    // navigate to a breadcrumb that was clicked
    widget.activateBreadcrumb = function (level, value) {
	var widget = this;
	
	var container = stm.DataStore.dataContainer[widget.selectedContainer];	

	// remove all filters below the selected level
	var newfilters = [];
	var levels = container.parameters.displayType == "function" ? widget.ontLevels.Subsystems : widget.taxLevels;
	var filter = container.parameters.displayType == "function" ? container.parameters.ontFilter : container.parameters.taxFilter;
	for (var i=0; i<filter.length; i++) {
	    var f = filter[i];
	    var stay = true;
	    for (var h=0; h<levels.length; h++) {
		if (levels[h] == f.level) {
		    stay = false;
		    break;
		}
	    }
	    if (stay) {
		newfilters.push(f);
	    }
	}
	
	var bread = "<a href='#' onclick='Retina.WidgetInstances.metagenome_analysis[1].activateBreadcrumb(0);'>&raquo; all</a> ";
	    
	// add the breadcrumb as new filter
	if (value != null) {
	    newfilters.push({"level": levels[level], "source": container.parameters.displaySource, "value": value });
	    var hier = container.hierarchy[Retina.keys(container.hierarchy)[0]];
	    for (var h=0; h<=level; h++) {
		bread += "<a href='#' onclick='Retina.WidgetInstances.metagenome_analysis[1].activateBreadcrumb("+h+", \""+hier[h]+"\");'>&raquo; "+hier[h]+"</a> ";
	    }
	}
	
	container.parameters[container.parameters.displayType == "function" ? "ontFilter" : "taxFilter" ] = newfilters;
	container.breadcrumbs = bread;
	container.parameters.displayLevel = levels[value == null ? 0 : level + 1];
	
	if (! widget.container2matrix()) { return; }
	widget.showCurrentContainerParams();
	widget.visualize();
    };

    /*
      DATA CONTAINERS
    */

    // delete a container
    widget.removeDataContainer = function () {
	var widget = this;

	delete stm.DataStore.dataContainer[widget.selectedContainer];
	widget.selectedContainer = Retina.keys(stm.DataStore.dataContainer).length ? Retina.keys(stm.DataStore.dataContainer).sort()[0] : null;
	widget.showDataContainers();
	document.getElementById('dataprogress').innerHTML = '';
	document.getElementById('currentContainerParams').innerHTML = "";
	widget.loadDataUI();
    };

    // change a parameter of a container
    widget.changeContainerParam = function (param, value, value2, value3, value4) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];
	
	var container = stm.DataStore.dataContainer[widget.selectedContainer];

	if (param == 'displayLevel' && value == 'species') {
	    if (! confirm('Warning\n\nFor most applications using shotgun sequence data\nto infer taxonomic information below the genus level\n(while possible) is not a good idea.\n\nDo you still want to continue?') ) {
		for (var i=0; i<widget.taxLevels.length; i++) {
		    if (widget.taxLevels[i] == container.parameters.displayLevel) {
			document.getElementById('displayLevelSelect').selectedIndex = i;
			break;
		    }
		}
		return;
	    }
	}
	
	if (param == 'displaySource') {
	    container.parameters[param] = value;
	    if (widget.sourceType[value] !== container.parameters['displayType']) {
		param = 'displayType';
		value = widget.sourceType[value];
	    }
	}
	
	// check if this is a tax filter
	if (param == 'taxFilter') {
	    if (value == "remove") {
		container.parameters.taxFilter.splice(value2, 1);
	    } else {
		container.parameters.taxFilter.push({ "source": value2, "level": value3, "value": value4 });
	    }
	}
	// check if this is changing hit type
	else if (param == 'hittype') {
	    container.parameters.hittype = value;
	}
	// check if this is an ontology filter
	else if (param == 'ontFilter') {
	    if (value == "remove") {
		container.parameters.ontFilter.splice(value2, 1);
	    } else {
		container.parameters.ontFilter.push({ "source": value2, "level": value3, "value": value4 });
	    }
	}
	// check if this is a list filter
	else if (param == 'listFilter') {
	    if (value == 'remove') {
		delete container.parameters.listFilter;
	    } else {
		container.parameters.listFilter = value2;
	    }
	}
	// check if this is a numerical filter
	else if (param == "evalue" || param == "identity" || param == "alilength" || param == "abundance") {
	    container.parameters[param] = parseFloat(value);
	}
	else if (param =="default") {
	    container.parameters.evalue = widget.cutoffThresholds.evalue;
	    container.parameters.identity = widget.cutoffThresholds.identity;
	    container.parameters.alilength = widget.cutoffThresholds.alilength;
	    container.parameters.hittype = 'rephit';
	    container.parameters.abundace = 1;
	}
	else {
	    if (param == "displayType") {
		if (value == "function") {
		    container.parameters.displayLevel = "level1";
		} else {
		    container.parameters.displayLevel = "domain";
		}
	    }

	    // check breadcrumbs
	    if (param == "displayLevel") {
		container.breadcrumbs = "";

		var levels = container.parameters.displayType == "function" ? widget.ontLevels.Subsystems : widget.taxLevels;
		var filter = container.parameters.displayType == "function" ? container.parameters.ontFilter : container.parameters.taxFilter;
		var lindex;
		for (var i=0; i<levels.length; i++) {
		    if (levels[i] == value) {
			lindex = i;
			break;
		    }
		}
		
		// determine the tax levels above
		for (var i=0; i<filter.length; i++) {
		    var f = filter[i];
		    var findex;
		    for (var h=0; h<levels.length; h++) {
			if (levels[h] == f.level) {
			    findex = h;
			    break;
			}
		    }
		    
		    if (findex + 1 == lindex) {
			container.updateBreadcrumbs = "taxonomy";
			break;
		    }
		}
	    }
	    
	    container.parameters[param] = value;
	}
	document.getElementById('visualize').setAttribute('disabled', 'disabled');
	if (! widget.container2matrix()) { return; }
	
	// check for breadcrumbs
	if (container.updateBreadcrumbs) {
	    var bread = "<a href='#' onclick='Retina.WidgetInstances.metagenome_analysis[1].activateBreadcrumb(0);'>&raquo; all</a> ";
	    var hier = container.hierarchy[Retina.keys(container.hierarchy)[0]];
	    for (var h=0; h<hier.length - 1; h++) {
		bread += "<a href='#' onclick='Retina.WidgetInstances.metagenome_analysis[1].activateBreadcrumb("+h+", \""+hier[h]+"\");'>&raquo; "+hier[h]+"</a> ";
	    }
	    container.breadcrumbs = bread;
	    delete container.updateBreadcrumbs;
	}
	
	document.getElementById('visualize').removeAttribute('disabled');
	widget.showCurrentContainerParams();

	widget.visualize();
    };
    
    // change the container name
    widget.renameContainer = function (newName) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];
	
	if (newName && newName.length) {
	    if (stm.DataStore.dataContainer.hasOwnProperty(newName)) {
		alert("this name is already taken, please select another");
	    } else {
		stm.DataStore.dataContainer[newName] = stm.DataStore.dataContainer[widget.selectedContainer];
		delete stm.DataStore.dataContainer[widget.selectedContainer];
		widget.selectedContainer = newName;
		stm.DataStore.dataContainer[widget.selectedContainer].id = newName;
		widget.showDataContainers();
		widget.showCurrentContainerParams();
	    }
	} else {
	    alert("you did not choose a name");
	}
    };

    /*
      METADATA
    */

    widget.showMetadata = function (cat, newCol) {
	var widget = this;

	cat = cat || "mixs";

	// fill the base html
	document.getElementById('visualize').innerHTML = '\
<h3>edit metadata of current container items</h3>\
<ul><li>You can click any cell in the table and enter a new value</li><li>You can click a cell in the table and paste a single column of data from a textfile or Excel</li><li>You can add a new column via the + button in the last column</li><li>The entries are always sorted by the metagenome id (mgm1234.5)</li></ul><p>Updated values are <strong>temporary</strong> and will <strong>not</strong> be uploaded to the MG-RAST server. They will be stored in the profile you can download using the <i class="icon-folder-open"></i> profile manager at the top right of the page.</p><p>You can click the restore button below, to reset the metadata to what is reflected in our database.</p><p style="text-align: center; margin-top: 30px; margin-bottom: 30px;"><button class="btn btn-small" onclick="if(confirm(\'Really reset all data? All your changes will be lost.\'){Retina.WidgetInstances.metagenome_analysis[1].resetMetadata();}"><i class="icon icon-refresh"></i> restore original metadata</button></p>\
<ul class="nav nav-tabs" id="metadataEdit" style="margin-bottom: 0px;">\
  <li'+(cat == 'mixs' ? ' class="active"' : "")+'><a href="#mixs">MiXS</a></li>\
  <li'+(cat == 'project' ? ' class="active"' : "")+'><a href="#project">project</a></li>\
  <li'+(cat == 'library' ? ' class="active"' : "")+'><a href="#library">library</a></li>\
  <li'+(cat == 'sample' ? ' class="active"' : "")+'><a href="#sample">sample</a></li>\
  <li'+(cat == 'env_package' ? ' class="active"' : "")+'><a href="#env_package">environmental package</a></li>\
</ul>\
 \
<div class="tab-content" style="border: 1px solid #ddd; border-top: none; padding-top: 20px; padding-bottom: 20px;">\
  <div class="tab-pane'+(cat == 'mixs' ? ' active' : "")+'" id="mixs">mixs</div>\
  <div class="tab-pane'+(cat == 'project' ? ' active' : "")+'" id="project">project</div>\
  <div class="tab-pane'+(cat == 'library' ? ' active' : "")+'" id="library">library</div>\
  <div class="tab-pane'+(cat == 'sample' ? ' active' : "")+'" id="sample">sample</div>\
  <div class="tab-pane'+(cat == 'env_package' ? ' active' : "")+'" id="env_package">env_package</div>\
</div>';
	document.getElementById('data').style.display = "none";
	document.getElementById('visualize').style.display = "";
	jQuery('#metadataEdit a').click(function (e) {
	    e.preventDefault();
	    jQuery(this).tab('show');
	});

	// get all metadata of the current container
	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	var g = [ "mixs", "project", "env_package", "library", "sample" ];
	var allMD = { "mixs": {}, "project": {}, "env_package": {}, "library": {}, "sample": {} };
	var items = [];
	for (var i=0; i<c.items.length; i++) {
	    items.push(c.items[i].id);
	    var p = stm.DataStore.profile[c.items[i].id];
	    if (! p) {
		p = stm.DataStore.otuprofile[c.items[i].id];
	    }
	    if (! p.hasOwnProperty('originalMetadata')) {
		p.originalMetadata = jQuery.extend(true, {}, p.metagenome.metadata);
	    }
	}
	items = items.sort();
	for (var l=0; l<items.length; l++) {
	    for (var j=0; j<g.length; j++) {
		var p = stm.DataStore.profile[items[l]];
		if (! p) {
		    p = stm.DataStore.otuprofile[items[l]];
		}
		var d = p.metagenome.metadata.hasOwnProperty(g[j]) ? p.metagenome.metadata[g[j]].data : {};
		var mds = Retina.keys(d);
		for (var m=0; m<mds.length; m++) {
		    if (! allMD[g[j]].hasOwnProperty(mds[m])) {
			allMD[g[j]][mds[m]] = true;
		    }
		}
	    }
	}

	// iterate over the categories
	for (var j=0; j<g.length; j++) {

	    // get all fields for the current category
	    var d = Retina.keys(allMD[g[j]]);

	    // create table header
	    var html = [];
	    html.push('<table class="excel">');
	    html.push('<tr><th>ID</th><th>'+d.join('</th><th>')+'</th><th title="add a new column"><button class="btn btn-mini" onclick="jQuery(this).toggle();jQuery(this.nextSibling).toggle();document.getElementById(\''+g[j]+'\').parentNode.scrollLeft=document.getElementById(\''+g[j]+'\').parentNode.scrollLeftMax;">+</button><div class="input-append" style="display: none; position: relative; top: 4px;"><input type="text" style="font-size: 12px; height: 12px; width: 100px;"><button class="btn btn-mini" onclick="Retina.WidgetInstances.metagenome_analysis[1].addMDField(\''+g[j]+'\',this.previousSibling.value);">add</button></div></th></tr>');

	    // iterate over the metagenomes
	    for (var l=0; l<items.length; l++) {

		// start the current row
		html.push('<tr><th>'+items[l]+'</th>');
		
		// iterate over the data fields
		for (var k=0; k<d.length; k++) {

		    html.push('<td class="editable" id="'+items[l]+'|'+g[j]+'|'+d[k]+'" data-next="'+(l == items.length - 1 ? "" : items[l+1])+'" onclick="if(!this.innerHTML.match(/^\<input/)){Retina.WidgetInstances.metagenome_analysis[1].editMDField(this);}">');
		    
		    // data field is present
		    var p = stm.DataStore.profile[items[l]];
		    if (! p) {
			p = stm.DataStore.otuprofile[items[l]];
		    }
		    if (p.metagenome.metadata.hasOwnProperty(g[j]) && p.metagenome.metadata[g[j]].data.hasOwnProperty(d[k])) {
			var val = p.metagenome.metadata[g[j]].data[d[k]];
			html.push(val);
		    }

		    // data field is not present
		    else {
			html.push(' - ');
		    }

		    html.push('</td>');
		}

		// end the current row
		html.push('</tr>');
	    }
	    
	    html.push('</table>');
	    document.getElementById(g[j]).innerHTML = html.join('');
	}
	if (newCol !== undefined) {
	    document.getElementById(items[0]+"|"+cat+"|"+newCol).click();
	    document.getElementById(cat).parentNode.scrollLeft = document.getElementById(cat).parentNode.scrollLeftMax;
	}
    };

    widget.resetMetadata = function () {
	var widget = this;

	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	for (var i=0; i<c.items.length; i++) {
	    var p = stm.DataStore.profile[c.items[l].id];
	    if (! p) {
		p = stm.DataStore.otuprofile[c.items[l].id];
	    }
	    p.metagenome.metadata = jQuery.extend(true, {}, p.originalMetadata);
	}

	widget.showMetadata();
    };

    widget.editMDField = function (field) {
	var widget = this;

	var val = field.innerHTML;
	
	field.innerHTML = '';
	var input = document.createElement('input');
	input.setAttribute('type','text');
	input.setAttribute('value', val);
	field.appendChild(input);
	input.select();
	input.addEventListener('keypress', function (event) {
	    event = event || window.event;
	    var cell = this.parentNode;
	    if (event.keyCode == '13' || event.keyCode == '9') {
		cell.innerHTML = this.value;
		var data = cell.getAttribute('id').split(/\|/);
		var id = data[0];
		var cat = data[1];
		var fieldname = data[2];
		var nextCell = cell.getAttribute('data-next');
		Retina.WidgetInstances.metagenome_analysis[1].updateMDField(id, cat, fieldname, this.value);
		event.preventDefault();
		if (nextCell.length) {
		    document.getElementById(nextCell+"|"+cat+"|"+fieldname).click();
		}
	    }
	});
	input.addEventListener('blur', function (event) {
	    var cell = this.parentNode;
	    cell.innerHTML = this.value;
	    var data = cell.getAttribute('id').split(/\|/);
	    var id = data[0];
	    var cat = data[1];
	    var fieldname = data[2];
	    Retina.WidgetInstances.metagenome_analysis[1].updateMDField(id, cat, fieldname, this.value);
	});
	input.addEventListener('paste', function (event) {
	    event = event || window.event;
	    var cell = this.parentNode;
	    var textfield = this;
	    
	    var paste = event.clipboardData.getData('text/plain');
	    var rows = paste.split(/\n/);
	    for (var i=0; i<rows.length; i++) {
		var cols = rows[i].split(/\t/);
		textfield.value = cols[0];
		textfield.blur();

		var nextCell = cell.getAttribute('data-next');
		if (nextCell.length) {
		    var data = cell.getAttribute('id').split(/\|/);
		    var cat = data[1];
		    var fieldname = data[2];
		    cell = document.getElementById(nextCell+"|"+cat+"|"+fieldname);
		    cell.click();
		    textfield = cell.firstChild;
		} else {
		    break;
		}
	    }
	    
	    event.preventDefault();
	});
    };

    widget.updateMDField = function (id, cat, field, value) {
	var widget = this;

	var updated = false;
	var p = stm.DataStore.profile[id];
	if (! p) {
	    p = stm.DataStore.otuprofile[id];
	}
	if (! p.metagenome.metadata.hasOwnProperty(cat)) {
	    p.metagenome.metadata[cat] = { "data": {} };
	    updated = true;
	}

	if (p.metagenome.metadata[cat].data.hasOwnProperty(field) && p.metagenome.metadata[cat].data[field] != value) {
	    updated = true;
	}

	// update the prodile data
	p.metagenome.metadata[cat].data[field] = value;

	// get an id - index mapping
	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	var id2index = {};
	for (var i=0; i<c.items.length; i++){
	    id2index[c.items[i].id] = i;
	}

	// update the header entry in the container
	c.matrix.headers[id2index[id]][cat+"|"+field] = value;

	// check if the metadata was actually updated, if so mark it in the profile
	if (updated) {
	    p.metadataUpdated = true;
	}
    };

    widget.addMDField = function (cat, name) {
	var widget = this;

	if (name == undefined || ! name.length) { return };
	
	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	for (var i=0; i<c.items.length; i++) {
	    var p = stm.DataStore.profile[c.items[i].id];
	    if (! p.metagenome.metadata.hasOwnProperty(cat)) {
		p.metagenome.metadata[cat] = { "data": {} };
	    }
	    if (! p.metagenome.metadata[cat].data.hasOwnProperty(name)) {
		p.metagenome.metadata[cat].data[name] = "";
	    }
	}
	
	widget.showMetadata(cat, name);
    };
    
    /*
      HELPER FUNCTIONS
     */

    // display all current data containers
    widget.showDataContainers = function () {
	var widget = this;

	var container = document.getElementById('availableContainers');

	if (container) {
	    var html = "";
	    if (stm.DataStore.hasOwnProperty('dataContainer') && Retina.keys(stm.DataStore.dataContainer).length) {
		widget.showCurrentContainerParams();
		var keys = Retina.keys(stm.DataStore.dataContainer).sort();
		for (var i=0; i<keys.length; i++) {
		    if (! widget.selectedContainer) {
			widget.selectedContainer = keys[i];
		    }
		    var glow = "";
		    var name = keys[i];
		    if (keys[i] == widget.selectedContainer) {
			glow = " glow";
			name = "<span style='color: blue;'>"+name+"</span>";
		    }
		    html += "<div title='click to select analysis' style='width: 75px; word-wrap: break-word; float: left; text-align: center;' cname='"+keys[i]+"' onclick='Retina.WidgetInstances.metagenome_analysis[1].selectedContainer=this.getAttribute(\"cname\");Retina.WidgetInstances.metagenome_analysis[1].showDataContainers();Retina.WidgetInstances.metagenome_analysis[1].visualize();'><img src='Retina/images/bar-chart.png' class='tool"+glow+"'><br><div style='font-size: 11px; margin-top: -10px; text-align: center;'>"+name+"</div></div>";
		}
		
	    }
	    html += "<div title='create a new analysis' style='width: 75px; word-wrap: break-word; float: left; padding-left: 7px;' onclick='Retina.WidgetInstances.metagenome_analysis[1].loadDataUI();Retina.WidgetInstances.metagenome_analysis[1].showDataContainers();'><div class='tool' id='addDataIcon'><div style='font-weight: bold; font-size: 20px; margin-top: 4px; text-align: center;'>+</div></div></div>";
	    container.innerHTML = html;

	    if (widget.selectedContainer) {
		document.getElementById('containerActive').style.display = "";
	    } else {
		document.getElementById('containerActive').style.display = "none";
	    }
	}
    };

    widget.showCurrentContainerParams = function () {
	var widget = this;

	// get some basic variables
	var target = document.getElementById('currentContainerParams');
	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	var p = c.parameters;
	var taxLevels = widget.taxLevels;
	var ontLevels = widget.ontLevels;

	// container name
	var html = [ "<h4><span id='containerID'>"+widget.selectedContainer+"</span><span id='containerIDEdit' style='display: none;'><input type='text' value='"+c.id+"' id='containerIDInput'></span><button class='btn btn-mini pull-right btn-danger' style='margin-left: 10px;' title='delete analysis' onclick='if(confirm(\"Really delete this analysis? (This will not remove the loaded profile data)\")){Retina.WidgetInstances.metagenome_analysis[1].removeDataContainer();};'><i class='icon icon-trash'></i></button>"+(Retina.cgiParam('admin') ? "<button class='btn btn-mini pull-right' onclick='Retina.WidgetInstances.metagenome_analysis[1].showRecipeEditor();' title='create recipe'><img src='Retina/images/forkknife.png' style='width: 16px;'></button>" : "")+"<button class='btn btn-mini pull-right' id='uploadButton' onclick='Retina.WidgetInstances.metagenome_analysis[1].createAnalysisObject(true);' title='download container'><img src='Retina/images/cloud-download.png' style='width: 16px;'></button><button class='btn btn-mini pull-right' onclick='Retina.WidgetInstances.metagenome_analysis[1].exportData(\"shock\");' title='upload container to myData'><img src='Retina/images/cloud-upload.png' style='width: 16px;'></button><button class='btn btn-mini pull-right' id='toggleEditContainerName' onclick='jQuery(\"#containerID\").toggle();jQuery(\"#containerIDEdit\").toggle();' title='edit container name'><i class='icon icon-edit'></i></button>" ];
	html.push( "<button class='btn btn-mini pull-right' onclick='Retina.WidgetInstances.metagenome_analysis[1].mergeContainer();' title='merge container into new profile'><img src='Retina/images/merge.png' style='width: 16px;'></button>" );
	html.push("</h4>");

	// cutoffs
	
	// e-value
	html.push('<div class="input-prepend" id="evalueField" style="margin-right: 5px;"><button class="btn btn-mini" style="width: 50px;" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'evalue\',this.nextSibling.value);">e-value</button><input id="evalueInput" type="text" value="'+p.evalue+'" style="height: 12px; font-size: 12px; width: 30px;"></div>');

	// percent identity
	html.push('<div class="input-prepend" id="identityField" style="margin-right: 5px;"><button class="btn btn-mini" style="width: 50px;" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'identity\',this.nextSibling.value);">%-ident</button><input id="identityInput" type="text" value="'+p.identity+'" style="height: 12px; font-size: 12px; width: 30px;"></div>');

	// alignment length
	html.push('<div class="input-prepend" id="alilenField" style="margin-right: 5px;"><button class="btn btn-mini" style="width: 50px;" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'alilength\',this.nextSibling.value);">length</button><input id="alilenInput" type="text" value="'+p.alilength+'" style="height: 12px; font-size: 12px; width: 30px;"></div>');

	// abundance cutoff
	html.push('<div class="input-prepend"  id="abundanceField" style="margin-right: 5px;"><button class="btn btn-mini" style="width: 90px;" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'abundance\',this.nextSibling.value);">min.abundance</button><input id="abundanceInput" type="text" value="'+p.abundance+'" style="height: 12px; font-size: 12px; width: 30px;"></div>');

	// hit type
	html.push('<div class="btn-group" style="margin-bottom: 10px; margin-right: 5px;" data-toggle="buttons-radio" id="hittypeField" style="margin-right: 5px;"><button class="btn btn-mini'+(p.hittype=='rephit'?' active':'')+'" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'hittype\',\'rephit\');">representative hit</button><button class="btn btn-mini'+(p.hittype=='rephit'?'':' active')+'" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'hittype\',\'besthit\');">best hit</button></div>');

	// reset to default
	html.push('<button class="btn btn-mini" title="reset to defaults" style="position: relative; bottom: 5px;" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'default\')"><i class="icon icon-step-backward"></i></button>');

	// display params table
	html.push('<table style="font-size: 12px;">');

	// source
	html.push("<tr id='sourceField'><td>source</td><td><select id='sourceSelect' style='margin-bottom: 0px; font-size: 12px; height: 27px;' onchange='Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\"displaySource\",this.options[this.selectedIndex].value);'>");
	for (var i=0; i<c.parameters.sources.length; i++) {
	    var sel = "";
	    if (c.parameters.sources[i] == c.parameters.displaySource) {
		sel = " selected=selected";
	    }
	    html.push("<option"+sel+">"+c.parameters.sources[i]+"</option>");
	}
	html.push("</select></td></tr>");

	// level
	var displayLevelSelect = "<select id='displayLevelSelect' style='margin-bottom: 0px; font-size: 12px; height: 27px;' onchange='Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\"displayLevel\",this.options[this.selectedIndex].value);'>";
	if (c.parameters.displayType == "taxonomy") {

	    for (var i=0; i<taxLevels.length; i++) {
		var sel = "";
		if (taxLevels[i] == c.parameters.displayLevel) {
		    sel = " selected=selected";
		}
		displayLevelSelect += "<option value='"+taxLevels[i]+"'"+sel+">"+(taxLevels[i] == 'className' ? 'class' : taxLevels[i])+"</option>";
	    }
	} else {
	    if (ontLevels.hasOwnProperty(c.parameters.displaySource)) {
		for (var i=0; i<ontLevels[c.parameters.displaySource].length; i++) {
		    var sel = "";
		    if (ontLevels[c.parameters.displaySource][i] == c.parameters.displayLevel) {
			sel = " selected=selected";
		    }
		    displayLevelSelect += '<option'+sel+'>'+ontLevels[c.parameters.displaySource][i]+'</option>';
		}
	    }
	}
	displayLevelSelect += "</select>";
	html.push('<tr id="levelField"><td>level</td><td>'+displayLevelSelect+'</td></tr>');

	html.push('</table>');

	// filters
	html.push("<button id='filterField' class='btn btn-mini' style='margin-right: 5px;' title='add filter' onclick='jQuery(\"#addFilterDiv\").toggle();'><i class='icon icon-filter'></i></button><div style='display: none; margin-top: 3px;' id='addFilterDiv'>");

	// filter form

	// list filter
	if (widget.filterlists.hasOwnProperty(c.parameters.displaySource)) {
	    var k = Retina.keys(widget.filterlists[c.parameters.displaySource]).sort();
	    html.push('<div id="listFilterDiv" style="margin-bottom: 5px;"><h5>list filter</h5>');
	    html.push("<select style='margin-bottom: 2px; font-size: 12px; height: 27px;' id='displayListSelect' onchange='Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\"listFilter\", \"add\", this.options[this.selectedIndex].value);'><optgroup label='filter list'><option value='0'>- select list -</option>");
	    for (var i=0; i<k.length; i++) {
		var sel = "";
		if (c.parameters.listFilter && k[i] == c.parameters.listFilter) {
		    sel = " selected=selected";
		}
		html.push("<option"+sel+">"+k[i]+"</option>");
	    }
	    html.push("</optgroup></select>");
	    html.push('</div>');
	}

	// filter source
	html.push("<h5>taxonomy filter</h5><select id='taxType' style='margin-bottom: 2px; font-size: 12px; height: 27px;'>");
	for (var i=0; i<c.parameters.sources.length; i++) {
	    html.push("<option>"+c.parameters.sources[i]+"</option>");
	}
	html.push("</select>");
	
	// tax filter
	html.push('<div id="taxFilterDiv">');
	html.push("<select style='margin-bottom: 2px; font-size: 12px; height: 27px;' id='displayTaxSelect' onchange='if(this.selectedIndex<6){jQuery(\"#taxText\").data(\"typeahead\").source=stm.DataStore.taxonomy[this.options[this.selectedIndex].value];}else{jQuery(\"#taxText\").data(\"typeahead\").source=[];}'>");
	for (var i=0; i<taxLevels.length; i++) {
	    var sel = "";
	    if (taxLevels[i] == c.parameters.displayLevel) {
		sel = " selected=selected";
	    }
	    html.push("<option value='"+taxLevels[i]+"'>"+(taxLevels[i] == 'className' ? 'class' : taxLevels[i])+"</option>");
	}
	html.push("</select>");
	
	html.push("<div class='input-append'><input type='text' autocomplete='off' id='taxText' style='margin-bottom: 0px; font-size: 12px; height: 17px; width: 160px;'><button class='btn' style='font-size: 12px; height: 27px;' onclick='Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\"taxFilter\", \"add\", document.getElementById(\"taxType\").options[document.getElementById(\"taxType\").selectedIndex].value, this.parentNode.previousSibling.options[this.parentNode.previousSibling.selectedIndex].value, document.getElementById(\"taxText\").value);'>add</button></div>");
	html.push('</div>');
	
	// ont filter
	html.push('<div id="ontFilterDiv"><h5>function filter</h5>');
	var ontTypeSelect = [ '<select style="margin-bottom: 2px; font-size: 12px; height: 27px;" id="ontType" onchange="' ];
	var onts = Retina.keys(ontLevels).sort();
	for (var i=0; i<onts.length; i++) {
	    ontTypeSelect.push('document.getElementById(\''+onts[i]+'SelectDiv\').style.display=\'none\';');
	}
	ontTypeSelect.push('document.getElementById(this.options[this.selectedIndex].value+\'SelectDiv\').style.display=\'\';">');
	var ontSelects = [];
	for (var i=0; i<c.parameters.sources.length; i++) {
	    if (ontLevels.hasOwnProperty(c.parameters.sources[i])) {
		ontTypeSelect.push("<option>"+c.parameters.sources[i]+"</option>");
		ontSelects.push('<div id="'+c.parameters.sources[i]+'SelectDiv" style="'+(ontSelects.length ? "display: none;" : "")+'"><select style="margin-bottom: 2px; font-size: 12px; height: 27px;" id="'+c.parameters.sources[i]+'Select" onchange="jQuery(\'#'+c.parameters.sources[i]+'SelectText\').data(\'typeahead\').source=stm.DataStore.ontology[\''+c.parameters.sources[i]+'\'][this.options[this.selectedIndex].value];">');
		for (var h=0; h<ontLevels[c.parameters.sources[i]].length; h++) {
		    ontSelects.push('<option>'+ontLevels[c.parameters.sources[i]][h]+'</option>');
		}
		ontSelects.push('</select><div class="input-append"><input type="text" id="'+c.parameters.sources[i]+'SelectText" autocomplete="off" style="margin-bottom: 0px; font-size: 12px; height: 17px; width: 160px;"><button class="btn" style="font-size: 12px; height: 27px;" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'ontFilter\', \'add\', document.getElementById(\'ontType\').options[document.getElementById(\'ontType\').selectedIndex].value,this.parentNode.previousSibling.options[this.parentNode.previousSibling.selectedIndex].value, document.getElementById(\''+c.parameters.sources[i]+'SelectText\').value);">add</button></div></div>');
	    }
	}
	ontTypeSelect.push('</select>');
	html.push(ontTypeSelect.join('') + ontSelects.join(''));
	html.push('</div>');
	
	// end filter form
	html.push('</div>');
	
	var hasFilter = false;

	// list filter
	if (c.parameters.hasOwnProperty('listFilter')) {
	    html.push("<button class='btn btn-mini btn-primary' style='margin-right: 5px;' title='remove this filter' onclick='Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\"listFilter\", \"remove\");'>"+c.parameters.listFilter + " &times;</button>");
	    hasFilter = true;
	}
	
	// ontology
	for (var i=0; i<c.parameters.ontFilter.length; i++) {
	    html.push("<button class='btn btn-mini btn-primary' style='margin-right: 5px;' title='remove this filter' onclick='Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\"ontFilter\", \"remove\", \""+i+"\");'>"+c.parameters.ontFilter[i].source + " - " + c.parameters.ontFilter[i].level + " - " + c.parameters.ontFilter[i].value+" &times;</button>");
	    hasFilter = true;
	}

	// taxonomy
	for (var i=0; i<c.parameters.taxFilter.length; i++) {
	    html.push("<button class='btn btn-mini btn-primary' style='margin-right: 5px;' title='remove this filter' onclick='Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\"taxFilter\", \"remove\", \""+i+"\");'>"+c.parameters.taxFilter[i].source + " - " + c.parameters.taxFilter[i].level + " - " + c.parameters.taxFilter[i].value+" &times;</button>");
	    hasFilter = true;
	}

	if (! hasFilter) {
	    html.push('<span style="font-size: 12px;"> - no filter -</span>');
	}
	
	// result data
	html.push("<table style='font-size: 12px; width: 322px;'><th style='text-align: left;'>name</th><th style='text-align: right; padding-left: 10px;'>hits</th></tr>");
	for (var i=0; i<c.items.length; i++) {
	    html.push("<tr><td title='"+c.items[i].name+"' style='text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 250px;'><a href='mgmain.html?mgpage=overview&metagenome="+(c.items[i].status=="private" ? Retina.idmap(c.items[i].id) : c.items[i].id)+"' target=_blank>"+c.items[i].name+"</a></td><td style='text-align: right; padding-left: 10px;'>"+c.matrix.abundances[i].formatString()+"</td></tr>");
	}
	html.push("</table>");
	
	html.push("<hr>");

	target.innerHTML = html.join("");

	// attach events
	document.getElementById('containerIDInput').onkeyup = function (e) {
	    e = e || window.event;

	    if (e.keyCode==13) {
		Retina.WidgetInstances.metagenome_analysis[1].renameContainer(this.value);
	    } else if (e.keyCode==27) {
		document.getElementById("toggleEditContainerName").click();
	    }
	};
	document.getElementById('evalueInput').onkeyup = function (e) {
	    e = e || window.event;

	    if (e.keyCode==13) {
		this.previousSibling.click();
	    }
	};
	document.getElementById('identityInput').onkeyup = function (e) {
	    e = e || window.event;

	    if (e.keyCode==13) {
		this.previousSibling.click();
	    }
	};
	document.getElementById('alilenInput').onkeyup = function (e) {
	    e = e || window.event;

	    if (e.keyCode==13) {
		this.previousSibling.click();
	    }
	};
	document.getElementById('abundanceInput').onkeyup = function (e) {
	    e = e || window.event;

	    if (e.keyCode==13) {
		this.previousSibling.click();
	    }
	};
	jQuery("#taxText").typeahead({"source": stm.DataStore.taxonomy.domain});
	for (var i=0; i<c.parameters.sources.length; i++) {
	    if (ontLevels.hasOwnProperty(c.parameters.sources[i])) {
		jQuery("#"+c.parameters.sources[i]+"SelectText").typeahead({"source": stm.DataStore.ontology[c.parameters.sources[i]].level1});
	    }
	}
    };

    /*
      CALLBACK FUNCTIONS
     */

    // all promises for a data container have been fulfilled
    widget.dataContainerReady = function (name, abort) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];
	
	var dataContainer = stm.DataStore.dataContainer[name];
	if (! abort && Retina.keys(stm.DataStore.inprogress).length) {
	    return;
	}
	
	dataContainer.promises = [];
	widget.xhr = {};
	dataContainer.status = abort ? abort : "ready";
	for (var i=0; i<dataContainer.callbacks.length; i++) {
	    dataContainer.callbacks[i].call(null, dataContainer);
	}
    };

    /*
      DATA CONTAINER CONVERSION METHODS
    */

    widget.mergeContainer = function (container) {
	var widget = this;
	
	container = container || stm.DataStore.dataContainer[widget.selectedContainer];

	if (stm.DataStore.profile.hasOwnProperty(container.id)) {
	    if (! confirm("You already have a profile called\n'"+container.id+"',\noverwrite?")) {
		return;
	    }
	}
	
	var profile = { "columns": jQuery.extend(true, [], stm.DataStore.profile[container.items[0].id].columns),
			"created": new Date().toISOString(),
			"id": container.id,
			"condensed": true,
			"type": "merge",
			"metagenome": { "mixs": {}, "name": container.id, "id": container.id, "metadata": { "library": { "data": { "metagenome_name": container.id } } } },
			"sources": jQuery.extend(true, [], container.parameters.sources),
			"originalItems": jQuery.extend(true, [], container.items),
			"version": 1 };
	
	var data = {};
	for (var i=0; i<container.items.length; i++) {
	    var p = jQuery.extend(true, {}, stm.DataStore.profile[container.items[i].id]);
	    var rowlen = 5 + (p.sources.length * 2);
	    var psource = {};
	    for (var h=0; h<p.sources.length; h++) {
		psource[p.sources[h]] = h;
	    }
	    for (var h=0; h<p.data.length; h+=rowlen) {
		if (data.hasOwnProperty(p.data[h])) {
		    var row = data[p.data[h]];
		    row[2] = ((row[1] * row[2]) + (p.data[h+1] * p.data[h+2])) / (row[1] + p.data[h+1]);
		    row[3] = ((row[1] * row[3]) + (p.data[h+1] * p.data[h+3])) / (row[1] + p.data[h+1]);
		    row[4] = ((row[1] * row[4]) + (p.data[h+1] * p.data[h+4])) / (row[1] + p.data[h+1]);
		    row[1] = row[1] + p.data[h+1];
		    for (var j=0; j<profile.sources.length; j++) {
		    	var idsa = row[5+(j*2)] == null ? [] : (typeof row[5+(j*2)] == "number" ? [ row[5+(j*2)] ] : row[5+(j*2)].split(","));
		    	var idsb = p.data[h+5+(2*psource[profile.sources[j]])] == null ? [] : (typeof p.data[h+5+(2*psource[profile.sources[j]])] == "number" ? [ p.data[h+5+(2*psource[profile.sources[j]])] ] : p.data[h+5+(2*psource[profile.sources[j]])].split(","));
		    	var idh = {};
		    	for (var k=0; k<idsa.length; k++) {
		    	    idh[idsa[k]] = 1;
		    	}
		    	for (var k=0; k<idsb.length; k++) {
		    	    idh[idsb[k]] = 1;
		    	}
		    	var entry = Retina.keys(idh).join(",");
		    	row[5+(j*2)] = entry.length ? (entry.indexOf(',') > -1 ? entry : parseInt(entry)) : null;
			
		    	idsa = row[5+(j*2) + 1] == null ? [] : (typeof row[5+(j*2) + 1] == "number" ? [ row[5+(j*2) + 1] ] : row[5+(j*2) + 1].split(","));
		    	if (p.data[h+5+(2*psource[profile.sources[j]]) + 1] == null) {
		    	    idsb = [];
		    	} else {
		    	    if (typeof p.data[h+5+(2*psource[profile.sources[j]]) + 1] == "number") {
		    		idsb = [ p.data[h+5+(2*psource[profile.sources[j]]) + 1] ];
		    	    } else {
		    		idsb = p.data[h+5+(2*psource[profile.sources[j]]) + 1].split(",");
		    	    }
		    	}
		    	idh = {};
		    	for (var k=0; k<idsa.length; k++) {
		    	    idh[idsa[k]] = 1;
		    	}
		    	for (var k=0; k<idsb.length; k++) {
		    	    idh[idsb[k]] = 1;
		    	}
		    	entry = Retina.keys(idh).join(",");
		    	row[5+(j*2)+1] = entry.length ? (entry.indexOf(',') > -1 ? entry : parseInt(entry)) : null;
		    }
		    data[p.data[h]] = row;
		} else {
		    var row = [];
		    for (var j=0; j<5; j++) {
			row.push(p.data[h+j]);
		    }
		    for (var j=0; j<profile.sources.length; j++) {
			row.push(p.data[h+5+(2*psource[profile.sources[j]])]);
			row.push(p.data[h+5+(2*psource[profile.sources[j]])+1]);
		    }
		    data[p.data[h]] = row;
		}
	    }
	}
	var dsort = [];
	var md5s = Retina.keys(data);
	for (var i=0; i<md5s.length; i++) {
	    for (var h=0; h<data[md5s[i]].length; h++) {
		dsort.push(data[md5s[i]][h]);
	    }
	}
	
	profile.data = dsort
	profile.row_total = profile.data.length / (5 + (2 * profile.sources.length));
	profile.size = JSON.stringify(profile).length;
	stm.DataStore.profile[profile.id] = profile;
	widget.enableLoadedProfiles();

	alert("merged profile created");
    };

    widget.container2biom = function (container, abundanceOnly) {
	var widget = this;

	var result = [];
	
	container = container || stm.DataStore.dataContainer[widget.selectedContainer];

	if (abundanceOnly) {
	    var c = container;
	    var biom = {
		"matrix_element_type": "float",
		"generated_by": "MG-RAST",
		"format": "Biological Observation Matrix 1.0",
		"format_url": "http://biom-format.org",
		"id": c.items[0].id,
		"matrix_type": "dense",
		"date": Retina.date_string(),
		"type": "Feature table",
		"source_type": "protein",
		"data_source": c.parameters.displaySource,
		"shape": [ c.matrix.itemsY, c.matrix.itemsX ],
		"columns": [],
		"rows": [],
		"data": []
	    };

	    for (var i=0; i<container.items.length; i++) {
		biom.columns.push( { "id": container.items[i].name } );
	    }
	    
	    // construct the rows and data entries
	    for (var h=0; h<c.matrix.data.length; h++) {
		var md = {};
		if (c.parameters.displayType == "taxonomy") {
		    md.taxonomy = c.hierarchy[c.matrix.rows[h]];
		} else {
		    md.functionalHierarchy = c.hierarchy[c.matrix.rows[h]];
		}
		biom.rows.push( { "id": h+1, "metadata": md } );
		var row = [];
		for (var i=0; i<container.items.length; i++) {
		    row.push( c.matrix.data[h][i] );
		}
		biom.data.push( row );
	    }

	    result = [ biom ];
	    
	} else {
	    // iterate over all items of the container
	    for (var i=0; i<container.items.length; i++) {
		
		// set up the basic biom object
		var c = jQuery.extend(true, {}, container);
		c.items = [ c.items[i] ];
		c = widget.container2matrix(c);
		var biom = {
		    "matrix_element_type": "float",
		    "generated_by": "MG-RAST",
		    "format": "Biological Observation Matrix 1.0",
		    "format_url": "http://biom-format.org",
		    "id": c.items[0].id,
		    "matrix_type": "dense",
		    "date": Retina.date_string(),
		    "type": "Feature table",
		    "source_type": "protein",
		    "data_source": c.parameters.displaySource,
		    "shape": [ c.matrix.itemsY, 2 ],
		    "columns": [ { "id": "abundance" },
				 { "id": "e-value" } ],
		    "rows": [],
		    "data": []
		};
		
		// construct the rows and data entries
		for (var h=0; h<c.matrix.data.length; h++) {
		    var md = {};
		    if (c.parameters.displayType == "taxonomy") {
			md.taxonomy = c.hierarchy[c.matrix.rows[h]];
		    } else {
			md.functionalHierarchy = c.hierarchy[c.matrix.rows[h]];
		    }
		    biom.rows.push( { "id": h+1, "metadata": md } );
		    biom.data.push( [ c.matrix.data[h][0], c.matrix.evalues[h][0] ] );
		}
	    
		result.push(biom);
	    }
	}
	
	return result;
    };

    widget.OTUcontainer2matrix = function (container) {
	var widget = this;

	var c = container || stm.DataStore.dataContainer[widget.selectedContainer];

	var matrix = { data: [],
		       rows: [],
		       cols: [],
		       evalues: [],
		       abundances: [],
		       headers: [] };

	var levelIndex = { "domain": 0, "phylum": 1, "className": 2, "order": 3, "family": 4, "genus": 5, "species": 6 };//, "strain": 7 };
	var rlevelIndex = [ "domain", "phylum", "className", "order", "family", "genus", "species" ];
	var id = c.parameters.metadatum;
	var displayLevel = c.parameters.displayLevel;
	var displaySource  = c.parameters.displaySource;
	var displayType = c.parameters.displayType;
	var hier = {};
	var rows = {};
	var d = {};

	var filters = [];
	filters.push([ 2, c.parameters.evalue ]);
	filters.push([ 3, c.parameters.identity ]);
	filters.push([ 4, c.parameters.alilength ]);

	// parse through the profiles
	for (var i=0; i<c.items.length; i++) {
	    var p = stm.DataStore.otuprofile[c.items[i].id];

	    matrix.abundances.push(0);
	    var x = c.parameters.metadatum.split(/\|/);
	    var colname = "-";
	    if (! p.hasOwnProperty('metagenome')) {
		p.metagenome = {};
	    }
	    if (! p.metagenome.hasOwnProperty('metadata')) {
		p.metagenome.metadata = {};
	    }
	    if (! p.metagenome.metadata.hasOwnProperty('library')) {
		p.metagenome.metadata.library = { "data": { "metagenome_name": c.items[i].id } };
	    }
	    if (p.metagenome.metadata.hasOwnProperty(x[0]) && p.metagenome.metadata[x[0]].data.hasOwnProperty(x[1])) {
		colname = p.metagenome.metadata[x[0]].data[x[1]];
	    }
	    matrix.cols.push(colname);
	    var header = {};
	    var fields = [ "mixs", 'project', 'env_package', 'library', 'sample' ];
	    for (var h=0; h<fields.length; h++) {
		var mds = stm.DataStore.otuprofile[c.items[i].id].metagenome.metadata.hasOwnProperty(fields[h]) ? Retina.keys(stm.DataStore.otuprofile[c.items[i].id].metagenome.metadata[fields[h]].data) : [];
		for (var j=0; j<mds.length; j++) {
		    header[fields[h]+"|"+mds[j]] = stm.DataStore.otuprofile[c.items[i].id].metagenome.metadata[fields[h]].data[mds[j]];
		}
	    }
	    matrix.headers.push(header);
	    
	    for (var h=0; h<p.data.length; h++) {
		// 0 "lca",
		// 1 "abundance",
		// 2 "e-value",
		// 3 "percent identity",
		// 4 "alignment length",
		// 5 "md5s",
		// 6 "level"
		var tax = p.data[h][0].split(";");
		var r = tax[levelIndex[displayLevel]];
		if (p.data[h][6] <= levelIndex[displayLevel]) {
		    r = "lower specificity hits";
		    hier[r] = [];
		    for (var j=0; j<levelIndex[displayLevel]; j++) {
			hier[r].push(r);
		    }
		} else {
		    hier[r] = tax.slice(0, levelIndex[displayLevel] + 1);
		}

		var stay = true;
		
		// check cutoff filters
		for (var j=0; j<filters.length; j++) {
		    if (Math.abs(p.data[h][filters[j][0]]) < filters[j][1]) {
			stay = false;
			break;
		    }
		}

		if (! stay) {
		    continue;
		}

		// test for tax filters
		if (c.parameters.taxFilter.length) {

		    // if none of the filters match, the row goes
		    var stay = false;

		    // iterate over the list of taxonomy filters
		    for (var j=0; j<c.parameters.taxFilter.length; j++) {
			if (c.parameters.taxFilter[j].value == tax[levelIndex[c.parameters.taxFilter[j].level]]) {
			    stay = true;
			    break;
			}
		    }

		    if (! stay) {
			continue;
		    }
		}

		// if we get here, all filters passed
		
		// create / update row
		if (! rows.hasOwnProperty(r)) {
		    rows[r] = [];
		    for (var j=0; j<c.items.length; j++) {
			// abundance, evalue
			rows[r].push([0, 0]);
		    }
		}
		
		rows[r][i][1] = ((rows[r][i][0] * rows[r][i][1]) + (p.data[h][1] * p.data[h][2])) / (rows[r][i][0] + p.data[h][1]);
		rows[r][i][0] += p.data[h][1];
	    }	    
	}

	var k = Retina.keys(rows).sort();
	var mr = [];
	for (var i=0; i<k.length; i++) {
	    var rowIn = false;
	    var ra = [];
	    var re = [];
	    for (var h=0; h<rows[k[i]].length; h++) {
		if (rows[k[i]][h][0] >= c.parameters.abundance) {
		    rowIn = true;
		} else {
		    rows[k[i]][h][0] = 0;
		}
		ra.push(rows[k[i]][h][0]);
		re.push(rows[k[i]][h][1]);
	    }
	    if (! rowIn) {
		continue;
	    }
	    for (var h=0; h<ra.length; h++) {
		matrix.abundances[h] += ra[h];
	    }
	    mr.push(k[i]);
	    matrix.data.push(ra);
	    matrix.evalues.push(re);
	}
	matrix.rows = mr;

	c.parameters.depth = levelIndex[displayLevel];
	c.matrix = matrix;
	c.matrix.itemsX = matrix.cols.length;
	c.matrix.itemsY = matrix.rows.length;
	c.matrix.itemsProd = matrix.cols.length * matrix.rows.length;
	c.hierarchy = hier;

	return c;
    };

    widget.container2matrix = function (container, md5only) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];

	// get the current container
	var c = container || stm.DataStore.dataContainer[widget.selectedContainer];

	// check for OTU container
	if (c.items[0] && c.items[0].sequence_type == "otu") {
	    return widget.OTUcontainer2matrix(c);
	}

	// check if all profiles are loaded and have the required sources
	var missing = [];
	var missingids = [];
	for (var i=0; i<c.items.length; i++) {
	    if (stm.DataStore.profile.hasOwnProperty(c.items[i].id)) {
		var p = stm.DataStore.profile[c.items[i].id];
		for (var h=0; h<c.parameters.sources.length; h++) {
		    var nosource = true;
		    for (var j=0; j<p.sources.length; j++) {
			if (p.sources[j] == c.parameters.sources[h]) {
			    nosource = false;
			    break;
			}
		    }
		    if (nosource) {
			missing.push( c.items[i] );
			missingids.push(c.items[i].name + " (" + c.items[i].id + ")");
			break;
		    }
		}
	    } else {
		missing.push( c.items[i] );
		missingids.push(c.items[i].name + " (" + c.items[i].id + ")");
	    }
	}
	if (missing.length) {
	    if (widget.isRecipe || confirm("The following profiles required by your analysis are not currently loaded:\n\n"+missingids.join("\n")+"\n\nDo you want to load them now?")) {
		document.getElementById('data').setAttribute('style', "");
		document.getElementById('visualize').setAttribute('style', "display: none;");
		document.getElementById('data').innerHTML = '<div id="dataprogress" style="float: left; margin-top: 25px; margin-left: 20px; width: 90%;"></div><div style="clear: both;"></div>';
		widget.loadData(missing, c.id, true);
		return false;
	    }
	}

	// update the source map
	widget.updateSourceMap(c);

	/*
	  perform filter
	*/

	// fill the filters array with the cutoffs
    	var filters = [];
	filters.push([ 2, c.parameters.evalue ]);
	filters.push([ 3, c.parameters.identity ]);
	filters.push([ 4, c.parameters.alilength ]);
	
	// create array index lookups for taxonomy and ontology levels
	var levelIndex = { "domain": 0, "phylum": 1, "className": 2, "order": 3, "family": 4, "genus": 5, "species": 6 };//, "strain": 7 };
	var flevelIndex = { "Subsystems-level1": 0, "Subsystems-level2": 1, "Subsystems-level3": 2, "Subsystems-function": 3, "KO-level1": 0, "KO-level2": 1, "KO-level3": 2, "KO-function": 3, "COG-level1": 0, "COG-level2": 1, "COG-function": 2, "NOG-level1": 0, "NOG-level2": 1, "NOG-function": 3 };

	// initialize the output row hash
    	var rows = {};

	// iterate over the items in this container
    	for (var i=0; i<c.items.length; i++) {

	    // get the source map for this profile
	    var sm = c.parameters.sourceMap[c.items[i].id];

	    // initialize the rows for this item
    	    rows[c.items[i].id] = [];

	    // get the profile for this item
    	    var pid = c.items[i].id;
    	    var p = stm.DataStore.profile[pid];

	    // calculate the row length
	    var rl = 5 + (p.sources.length * 2);

	    // iterate over the data of this profile
    	    for (var h=0; h<p.data.length; h+=rl) {

		// if no filters hit, the row stays
    		var stay = true;

		// check list filter
		if (c.parameters.listFilter) {
		    
		    // the the function array for this row for this ontology
		    var funcs = p.data[h + 6 + (sm[c.parameters.displaySource] * 2)];
			
		    // if there is no function, it definitely fails
		    if (funcs == null) {
			continue;
		    } else if (typeof funcs == "number") {
			funcs = [ funcs ];
		    } else if (typeof funcs == "string") {
			funcs = funcs.split(",");
		    }

		    // iterate over the function array
		    var iterator = c.parameters.hittype == 'rephit' ? 1 : funcs.length;
		    for (var k=0; k<iterator; k++) {

			// if the ontology does not have an entry for this id, we're in trouble
			if (stm.DataStore.ontology[c.parameters.displaySource]['id'].hasOwnProperty(funcs[k])) {

			    // get the value in the chosen ontology and level
			    var val = stm.DataStore.ontology[c.parameters.displaySource]['function'][stm.DataStore.ontology[c.parameters.displaySource]['id'][funcs[k]][flevelIndex[c.parameters.displaySource+"-function"]]];
			    // we have a match, the row stays
			    if (! widget.filterlists[c.parameters.displaySource][c.parameters.listFilter][val]) {
				stay = false;
			    }
			}
		    }
		}
		
		// test cutoff filters
		for (var j=0; j<filters.length; j++) {
    		    if (Math.abs(p.data[h + filters[j][0]]) < filters[j][1]) {
    			stay = false;
    			break;
    		    }
    		}

		// if it did not pass the cutoff filter, go to the next row
		if (! stay) {
		    continue;
		}

		// test for tax filters
		if (c.parameters.taxFilter.length) {

		    // if none of the filters match, the row goes
		    stay = false;

		    // iterate over the list of taxonomy filters
		    for (var j=0; j<c.parameters.taxFilter.length; j++) {

			// get the organism array of this row for this source
			var orgs = p.data[h + 5 + (sm[c.parameters.taxFilter[j].source] * 2)];

			// if there is no organism, it definitely fails
			if (orgs == null) {
			    break;
			} else if (typeof orgs == "number") {
			    orgs = [ orgs ];
			} else if (typeof orgs == "string") {
			    orgs = orgs.split(",");
			}

			// iterate over the organisms
			var iterator = c.parameters.hittype == 'rephit' ? 1 : orgs.length;
			for (var k=0; k<iterator; k++) {			    

			    // check if the organism exists in the taxonomy
			    if (stm.DataStore.taxonomy.organism.hasOwnProperty(orgs[k])) {

				// get the value of the organism id in the chosen hierarchy level
				var val = stm.DataStore.taxonomy[c.parameters.taxFilter[j].level][stm.DataStore.taxonomy.organism[orgs[k]][levelIndex[c.parameters.taxFilter[j].level]]];

				// if the user selected value is a match to val, the row is in and we do not need
				// to check the other organisms
				if (c.parameters.taxFilter[j].value == val) {
				    stay = true;
				    break;
				}
			    } else {

				// this is bad, the taxonomy does not match the data in the profile
				if (orgs[k]) {
				    console.log("org not found: "+orgs[k])
				}
			    }
			}

			// if one org passed, we dont need to check the others
			if (stay) {
			    break;
			}
		    }
		}

		// if the org did not pass, go to the next iteration
		if (! stay) {
		    continue;
		}

		// test for function filters
		if (c.parameters.ontFilter.length) {

		    // if there is no match, the row goes
		    stay = false;

		    // iterate over the list of function filters
		    for (var j=0; j<c.parameters.ontFilter.length; j++) {

			// the the function array for this row for this ontology
			var funcs = p.data[h + 6 + (sm[c.parameters.ontFilter[j].source] * 2)];
			
			// if there is no function, it definitely fails
			if (funcs == null) {
			    break;
			} else if (typeof funcs == "number") {
			    funcs = [ funcs ];
			} else if (typeof funcs == "string") {
			    funcs = funcs.split(",");
			}
			
			var source = c.parameters.ontFilter[j].source;
			var level = c.parameters.ontFilter[j].level;
			if (! stm.DataStore.ontology.hasOwnProperty(source)) {
			    stay = false;
			    break;
			}

			// iterate over the function array
			var iterator = c.parameters.hittype == 'rephit' ? 1 : funcs.length;
			for (var k=0; k<iterator; k++) {

			    // if the ontology does not have an entry for this id, we're in trouble
			    if (stm.DataStore.ontology[source]['id'].hasOwnProperty(funcs[k])) {

				// get the value in the chosen ontology and level
				var val = stm.DataStore.ontology[source][level][stm.DataStore.ontology[source]['id'][funcs[k]][flevelIndex[source+"-"+level]]];

				// we have a match, the row stays
				if (c.parameters.ontFilter[j].value == val) {
				    stay = true;
				    break;
				}
			    } else {
				console.log("func not found: "+funcs[k])
			    }
			}

			// if there is at least one match, the row stays
			if (stay) {
			    break;
			}
		    }
		}

		// the row passed all filters, push it to the result
    		if (stay) {
    		    rows[c.items[i].id].push(h);
    		}
    	    }
    	}

	/*
	  create matrix
	*/

	// initialize data fields
	var matrix = { data: [],
		       rows: [],
		       cols: [],
		       evalues: [],
		       percentidentities: [],
		       alignmentlengths: [],
		       abundances: [],
		       headers: [] };

	var id = c.parameters.metadatum;
	var displayLevel = c.parameters.displayLevel;
	var displaySource  = c.parameters.displaySource;
	var displayType = c.parameters.displayType;

	var d = {};
	var e = {};
	var alen = {};
	var perid = {};
	var hier = {};
	var md5s = {};
	var dataRow = 1;
	var profilesMissingSource = [];
	for (var i=0; i<c.items.length; i++) {
	    md5s[c.items[i].id] = [];
	    matrix.abundances.push(0);
	    var x = c.parameters.metadatum.split(/\|/);
	    var colname = "-";
	    if (stm.DataStore.profile[c.items[i].id].metagenome.metadata.hasOwnProperty(x[0]) && stm.DataStore.profile[c.items[i].id].metagenome.metadata[x[0]].data.hasOwnProperty(x[1])) {
		colname = stm.DataStore.profile[c.items[i].id].metagenome.metadata[x[0]].data[x[1]];
	    }
	    matrix.cols.push(colname);
	    var header = {};
	    var fields = [ "mixs", 'project', 'env_package', 'library', 'sample' ];
	    for (var h=0; h<fields.length; h++) {
		var mds = stm.DataStore.profile[c.items[i].id].metagenome.metadata.hasOwnProperty(fields[h]) ? Retina.keys(stm.DataStore.profile[c.items[i].id].metagenome.metadata[fields[h]].data) : [];
		for (var j=0; j<mds.length; j++) {
		    header[fields[h]+"|"+mds[j]] = stm.DataStore.profile[c.items[i].id].metagenome.metadata[fields[h]].data[mds[j]];
		}
	    }
	    matrix.headers.push(header);

	    var sourceIndex;
	    if (c.parameters.sourceMap[c.items[i].id].hasOwnProperty(c.parameters.displaySource)) {
		sourceIndex = c.parameters.sourceMap[c.items[i].id][c.parameters.displaySource];
	    } else {
		profilesMissingSource.push(c.items[i].name);
		continue;
	    }
	    
	    var pid = c.items[i].id;
	    var p = stm.DataStore.profile[pid];
	    for (var h=0; h<rows[c.items[i].id].length; h++) {

		// get the row
		var row = rows[c.items[i].id][h];

		// get the md5s
		if (md5only) {
		    md5s[c.items[i].id].push(p.data[row]);
		    continue;
		}

		// get the abundance
		var val = p.data[row + dataRow];

		// get the display indices
		var datums = p.data[row + 5 + (sourceIndex * 2) + (displayType == "taxonomy" ? 0 : 1)];

		// if there is no index, skip this row
		if (datums == null) {
		    continue;
		} else if (typeof datums == "number") {
		    datums = [ datums ];
		} else if (typeof datums == "string") {
		    datums = datums.split(",");
		}
		
		// find indices in target id space
		var key;
		var hitlen = 1;
		if (c.parameters.hittype != 'rephit') {
		    hitlen = datums.length;
		}
		for (var k=0; k<hitlen; k++) {
		    if (displayType == "taxonomy") {
			if (! stm.DataStore.taxonomy["organism"][datums[k]]) {
			    console.log("organism not found: "+datums[k]);
			    continue;
			}
			key = stm.DataStore.taxonomy[displayLevel][stm.DataStore.taxonomy["organism"][datums[k]][levelIndex[displayLevel]]];
			hier[key] = [];
			for (var j=0; j<=levelIndex[displayLevel]; j++) {
			    hier[key].push(stm.DataStore.taxonomy[widget.taxLevels[j]][stm.DataStore.taxonomy["organism"][datums[k]][j]]);
			}
		    } else {
			if (! stm.DataStore.ontology.hasOwnProperty(displaySource)) {
			    continue;
			}
			if (! stm.DataStore.ontology[displaySource]['id'][datums[k]]) {
			    console.log("function not found: "+datums[k]);
			    continue;
			}
			key = stm.DataStore.ontology[displaySource][displayLevel][stm.DataStore.ontology[displaySource]['id'][datums[k]][flevelIndex[displaySource+"-"+displayLevel]]];
			hier[key] = [];
			for (var j=0; j<=flevelIndex[displaySource+"-"+displayLevel]; j++) {
			    hier[key].push(stm.DataStore.ontology[displaySource][widget.ontLevels[displaySource][j]][stm.DataStore.ontology[displaySource]['id'][datums[k]][j]]);
			}
		    }
		    if (! d.hasOwnProperty(key)) {
			d[key] = [];
			e[key] = [];
			alen[key] = [];
			perid[key] = [];
			for (var j=0;j<c.items.length;j++) {
			    d[key][j] = 0;
			    e[key][j] = 0;
			    alen[key][j] = 0;
			    perid[key][j] = 0;
			}
		    }
		    d[key][i] += val;
		    e[key][i] += val * p.data[row + dataRow + 1];
		    perid[key][i] += val * p.data[row + dataRow + 2];
		    alen[key][i] += val * p.data[row + dataRow + 3];
		    matrix.abundances[i] += val;
		}
	    }
	}

	if (md5only) {
	    return md5s;
	}
	
	matrix.rows = Retina.keys(d).sort();
	var mr = [];
	for (var i=0; i<matrix.rows.length; i++) {
	    // test abundance cutoff
	    if (c.parameters.abundance > 1) {
		var rowIn = false;
		for (var h=0; h<d[matrix.rows[i]].length; h++) {
		    if (d[matrix.rows[i]][h] >= c.parameters.abundance) {
			rowIn = true;
		    } else {
			d[matrix.rows[i]][h] = 0;
		    }
		}
		if (! rowIn) {
		    continue;
		}
	    }
	    mr.push(matrix.rows[i]);
	    
	    matrix.data.push(d[matrix.rows[i]]);
	    for (var h=0; h<e[matrix.rows[i]].length; h++) {
		e[matrix.rows[i]][h] = e[matrix.rows[i]][h] / d[matrix.rows[i]][h];
		alen[matrix.rows[i]][h] = alen[matrix.rows[i]][h] / d[matrix.rows[i]][h];
		perid[matrix.rows[i]][h] = perid[matrix.rows[i]][h] / d[matrix.rows[i]][h];
	    }
	    matrix.evalues.push(e[matrix.rows[i]]);
	    matrix.alignmentlengths.push(alen[matrix.rows[i]]);
	    matrix.percentidentities.push(perid[matrix.rows[i]]);
	}
	matrix.rows = mr;

	var hasZero = 0;
	for (var i=0; i<matrix.abundances.length; i++) {
	    if (matrix.abundances[i] == 0) {
		hasZero++;
	    }
	}
	if (matrix.abundances.length == hasZero) {
	    hasZero = true;
	} else {
	    hasZero = false;
	}
	
	c.parameters.depth = (displayType == "taxonomy" ? levelIndex[displayLevel] : flevelIndex[displaySource+"-"+displayLevel]) + 1;
	c.matrix = matrix;
	c.matrix.itemsX = matrix.cols.length;
	c.matrix.itemsY = matrix.rows.length;
	c.matrix.itemsProd = matrix.cols.length * matrix.rows.length;
	c.hierarchy = hier;

	if (hasZero) {
	    alert("None of your datasets have hits when applying the chosen cutoffs and filters.\n\nLowering cutoffs and removing filters may provide more hits.");
	}
	
	return c;
    };

    widget.containerSetIDs = function (container, metadatum) {
	var widget = this;

	var redraw = true;
	if (container) {
	    redraw = false;
	} else {
	    container = stm.DataStore.dataContainer[widget.selectedContainer];
	}

	container.parameters.metadatum = metadatum;
	for (var i=0; i<container.matrix.cols.length; i++) {
	    var x = metadatum.split(/\|/);
	    container.matrix.cols[i] = stm.DataStore.profile[c.items[h].id].metagenome.metadata[x[0]].data.hasOwnProperty(x[1]) ? stm.DataStore.profile[c.items[h].id].metagenome.metadata[x[0]].data[x[1]] : "-";
	}

	if (redraw) {
	    widget.visualize(widget.currentType);
	}
    };

    widget.container2table = function (data, forExport, allData) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];
	
	var c = stm.DataStore.dataContainer[widget.selectedContainer];

	var matrix = jQuery.extend(true, {}, data ? data : stm.DataStore.dataContainer[widget.selectedContainer].matrix);
	var l = c.hierarchy[Retina.keys(c.hierarchy)[0]].length;
	var tableHeaders = [];
	for (var i=0; i<l; i++) {
	    tableHeaders.push(document.getElementById('displayLevelSelect').options[i].value);
	}
	for (var i=0; i<matrix.cols.length; i++) {
	    tableHeaders.push(matrix.cols[i]);
	}

	var tableData = [];
	if (allData) {
	    tableHeaders = [ 'dataset' ];
	    for (var i=0; i<matrix.cols.length - c.items.length; i++) {
		tableHeaders.push(matrix.cols[i]);
	    }
	    tableHeaders.push('abundance');
	    tableHeaders.push('e-value');
	    tableHeaders.push('alignment length');
	    tableHeaders.push('percent identity');
	    
	    var x = c.parameters.metadatum.split(/\|/);
	    for (var j=0; j<c.items.length; j++) {
		var md = stm.DataStore.profile[c.items[j].id].metagenome.metadata[x[0]].data.hasOwnProperty(x[1]) ? stm.DataStore.profile[c.items[j].id].metagenome.metadata[x[0]].data[x[1]] : "-";
		for (var i=0; i<matrix.rows.length; i++) {
		    var row = [ md ];
		    for (var h=0; h<l; h++) {
			row.push(c.hierarchy[matrix.rows[i]][h]);
		    }
		    
		    row.push(matrix.data[i][j]);

		    row.push(matrix.evalues[i][j]);
		    row.push(matrix.alignmentlengths[i][j]);
		    row.push(matrix.percentidentities[i][j]);
		    
		    tableData.push(row);
		}
	    }
	} else {
	    for (var i=0; i<matrix.rows.length; i++) {
		var row = [];
		for (var h=0; h<l; h++) {
		    if (forExport) {
			row.push(c.hierarchy[matrix.rows[i]][h]);
		    } else {
			if (h == l-1 && h < document.getElementById('displayLevelSelect').options.length - 1) {
			    row.push('<a href="#" onclick="Retina.WidgetInstances.metagenome_analysis[1].graphCallback({\'cellValue\': \''+c.hierarchy[matrix.rows[i]][h]+'\'})">'+c.hierarchy[matrix.rows[i]][h]+'</a>');
			} else {
			    row.push(c.hierarchy[matrix.rows[i]][h]);
			}
		    }
		}
		for (var h=0; h<matrix.data[i].length; h++) {
		    row.push(matrix.data[i][h]);
		}
		tableData.push(row);
	    }
	}
	
	return { data: tableData, header: tableHeaders };
    };

    widget.container2pca = function (data) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];

	var c = stm.DataStore.dataContainer[widget.selectedContainer];

	var matrix = Retina.copyMatrix(data ? data.data : c.matrix.data);

	// test if we have any data
	var sum = 0;
	for (var i=0; i<matrix.length; i++) {
	    for (var h=0; h<matrix[i].length; h++) {
		sum += matrix[i][h];
	    }
	}
	if (sum == 0) {
	    alert("your selection does not contain any hits");
	    return false;
	}
	
	var cols = data ? data.cols : c.matrix.cols;
	var pca = Retina.pca(Retina.distanceMatrix(Retina.transposeMatrix(matrix), c.visualization.pca.distance));
	var points = [];

	for (var i=0; i<pca.coordinates.length; i++) {
	    c.items[i].pca_component = { "label": i+" ("+pca.weights[i].toFixed(6)+")", "value": i };
	    points.push( { "x": pca.coordinates[i][c.visualization.pca.pcaa], "y": pca.coordinates[i][c.visualization.pca.pcab], "name": cols[i] } );
	}
	
	return { "data": [ { "points": points } ], "cols": cols, "headers": c.matrix.headers };
    };

    widget.container2differential = function () {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];
	
	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	
	var matrix = Retina.copyMatrix(c.matrix.data);
	var points = [];
	for (var i=0; i<matrix.length; i++) {
	    points.push( { "x": Retina.log10(matrix[i][c.visualization.differential.mga]), "y": Retina.log10(matrix[i][c.visualization.differential.mgb]), name: c.matrix.rows[i] });
	}
	
	return { "data": [ { "points": points } ] };
    };

    widget.container2plot = function (field) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];
	var c = stm.DataStore.dataContainer[widget.selectedContainer];
	var groups = [];
	for (var i=0; i<c.items.length; i++) {
	    groups.push({ name: c.matrix.cols[i], points: [] });
	    var p = stm.DataStore.profile[c.items[i].id];
	    if (! p) {
		p = stm.DataStore.otuprofile[c.items[i].id];
	    }
	    var data = jQuery.extend(true, [], p.metagenome.statistics[field]);
	    if (data.length == 0) {
		groups[i].points.push({x: 0, y: 0 });
	    }
	    for (var h=0; h<data.length; h++) {
		groups[i].points.push({x: data[h][0], y: data[h][1]});
	    }
	}

	return { data: groups };
    };

    /*
      DATA SECTION
     */
    widget.visualizationMapping = function () {
	return { 'matrix': { title: 'abundance matrix',
			     renderer: "matrix",
			     settings: {
				 description: "The abundance matrix shows the samples as columns and the categories as rows. The abundance relative to the other samples in a category is highlighted by the opacity of the circle.</p><p>You can choose to enable / disable <a href='https://github.com/MG-RAST/tech-report/wiki/MG-RAST-glossary#normalisation' target=_blank>normalisation</a>, <a href='https://github.com/MG-RAST/tech-report/wiki/MG-RAST-glossary#log-10' target=_blank>log scaling</a> and select the sample label by <a href='https://github.com/MG-RAST/tech-report/wiki/MG-RAST-glossary#metadata' target=_blank>metadata</a> field.</p><p>Click a category to drill down to the next level. The layout tab has options to adjust the general layout of the matrix.",
				 extended: { "adjust graph data": true }
			     },
			     controlGroups: [
				 { "adjust graph data":
				   [
				       { "name": "metadatum", "type": "select", "description": "metadatum to name the datasets by", "title": "metadatum", "adaptToData": true, "default": "library|metagenome_name", "isDataUpdater": true, "values": "metadata" },
				       { "name": "normalize", "type": "bool", "description": "normalize the datasets", "title": "perform normalization", "isDataUpdater": true, "defaultTrue": true },
				       { "name": "log", "type": "bool", "description": "view log base 10 of the data", "title": "perform log10", "isDataUpdater": true, "defaultTrue": false }
				   ]
				 },
				 { "layout":
				   [
				       { "name": "colHeaderHeight", "type": "int", "description": "height of the header column", "title": "column height", "default": 100 },
				       { "name": "circleColor", "type": "color", "description": "base color of the circles", "title": "ccircle color", "default": "purple" }
				   ]
				 }
			     ]
			   },
		 'heatmap': { title: 'heatmap',
			      renderer: "svg2",
			      settings: widget.graphs.heatmap,
			      controlGroups: widget.graphs.heatmap.controls
			    },
		 'piechart': { title: 'pie-chart',
			       renderer: "svg2",
			       settings: widget.graphs.pie,
			       controlGroups: widget.graphs.pie.controls
			     },
		 'donutchart': { title: 'donut-chart',
				 renderer: "svg2",
				 settings: widget.graphs.donut,
				 controlGroups: widget.graphs.donut.controls
			     },
		 'barchart': { title: 'stacked bar-chart',
			       renderer: "svg2",
			       settings: widget.graphs.stackedBar,
			       controlGroups: widget.graphs.stackedBar.controls
			     },
		 'barchart2': { title: 'grouped barchart',
				renderer: "svg2",
				settings: widget.graphs.bar,
				controlGroups: widget.graphs.bar.controls,
				logAxes: [ 0 ]
			     },
		 'pca': { title: 'PCoA',
			  renderer: 'svg2',
			  settings: widget.graphs.pca,
			  controlGroups: widget.graphs.pca.controls,
			  dataConversion: 'container2pca' },
		 'differential': { title: 'differential coverage',
				   renderer: 'svg2',
				   settings: widget.graphs.differential,
				   controlGroups: widget.graphs.differential.controls,
				   dataConversion: 'container2differential' },
		 'table': { title: 'table',
			    renderer: 'table',
			    settings: { extended: { "adjust table data": true },
					description: "The table shows the samples as columns and the categories as rows. Click the magnifying glass to show the filter for a column. Click the operator in the abundance column filters to change it.</p><p>You can choose to enable / disable <a href='https://github.com/MG-RAST/tech-report/wiki/MG-RAST-glossary#normalisation' target=_blank>normalisation</a> and select the sample label by <a href='https://github.com/MG-RAST/tech-report/wiki/MG-RAST-glossary#metadata' target=_blank>metadata</a> field.</p><p>Click a category to drill down to the next level. The cogwheel icon above the table opens general options for the table.",
					sort_autodetect: true,
					filter_autodetect: true },
			    dataConversion: "container2table",
			    controlGroups:
			    [
				{ "adjust table data":
				   [
				       { "name": "metadatum", "type": "select", "description": "metadatum to name the datasets by", "title": "metadatum", "adaptToData": true, "default": "library|metagenome_name", "isDataUpdater": true, "values": "metadata" },
				       { "name": "normalize", "type": "bool", "description": "normalize the datasets", "title": "perform normalization", "isDataUpdater": true }
				   ]
				}
			    ]
			  },
		 'rarefaction': { title: 'rarefaction plot',
				  renderer: 'svg2',
				  settings: widget.graphs.rarefaction,
				  controlGroups: widget.graphs.rarefaction.controls,
				  dataConversion: "container2plot",
				  dataField: "rarefaction"
				}
	       };
    };
    
    /*
      DATA LOADING UI
    */
    widget.loadDataUI = function () {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];

	var target = document.getElementById('data');
	document.getElementById("visualize").style.display = "none";
	document.getElementById("data").style.display = "";

	if (! widget.hasOwnProperty('mgselect')) {

	    // border and title
	    var html = [];

	    if (widget.isRecipe) {
		html.push("<div style='border: 1px solid #dddddd; border-radius: 6px; padding: 10px;'><h3 style='margin-top: 0px;'>Analysis Recipe: <span id='recipeTitle'></span></h3><p>To start select datasets below and click <a class='btn btn-mini btn-success' style='position: relative; left: 5px; bottom: 1px;'><i class='icon-ok icon-white'></i></a></p><p>The analysis recipe will guide you through the analysis by presetting all parameters. You only need to select the datasets you want to perform the analysis for. Use the <span style='font-weight: bold; cursor: help;' onmouseover='document.getElementById(\"mgselect\").className=\"glow\";' onmouseout='document.getElementById(\"mgselect\").className=\"\";'>selection box</span> below to do so."+(widget.recipe.defaultDatasets && widget.recipe.defaultDatasets.length ? " This recipe has default datasets selected. Feel free to use these or exchange them for datasets of your choice. " : "" )+"</p><p>Once the data is loaded, you will immediately see the analysis results. The <span style='font-weight: bold; cursor: help;' onmouseover='document.getElementById(\"recipeDisplay\").className=\"glow\";' onmouseout='document.getElementById(\"recipeDisplay\").className=\"\";'>recipe description</span> is always visible on the righthand side. It will also inform you about important parameters you can adjust. Hover over the highlighted terms to see where to change those parameters.</p><div>");
	    } else {
		html.push("<div style='border: 1px solid #dddddd; border-radius: 6px; padding: 10px;'><h3 style='margin-top: 0px;'>Create a new Analysis");

		/*
		  This has been commented out and should be put back in to enable recipes
		 */
		//html.push("<button style='float: right;' class='btn btn-info' onclick='window.location=\"mgmain.html?mgpage=recipe\";'>Looks complicated?<br>Try out recipes!</button>");
		
		html.push("</h3><p>To perform an analysis, you must first load the metagenomic profiles to analyze. A profile holds the abundance values and cutoffs for a list of database sources for a specific dataset. You can select the databases and datasets, as well as a name for your analysis below. Click the <i class='icon-ok'></i></a>-button to load the data from our server.</p><p>Profiles are generated on demand. Depending on profile size the initial calculation may take some time. Once computed they will be cached and subsequent requests will download immediately. You can use the <i class=\"icon icon-folder-open\"></i>-icon in the top menu bar to store profiles on your harddrive and upload them back into your browser cache (without requiring interaction with our server).</p><p>Once all required data is loaded you can start the analysis.</p><div style='overflow-x: auto;'>");
	    }


	    // params container
	    html.push("<div>");
	    if (! widget.isRecipe) {
		// protein vs rna
		html.push('<div style="float: left;"><h5>selected databases</h5><div id="pickedDatabases"></div></div><div style="float: right; margin-right: 50px;"><h5>available databases</h5><div id="availableDatabases"></div></div>');
	    }

	    // params container close and divider
	    html.push('</div><div style="clear: both;"></div>');

	     // metagenome selector
	    html.push('<h5 style="margin-top: 0px;"><div style="float: left;">metagenomes</div><div style="float: left; margin-left: 443px; height: 20px;"></div><div style="float: left; margin-right: 5px;" id="collectionSpace"></div><div style="float: left;" id="loadedProfileSpace"></div><div style="float: left;" id="loadedOTUProfileSpace"></div></h5><div style="clear: both; height: 5px;"></div><div id="mgselect"><img src="Retina/images/waiting.gif" style="margin-left: 40%; width: 24px;"></div>');

	    // data progress
	    html.push('<div id="dataprogress" style="float: left; margin-top: 25px; margin-left: 20px; width: 90%;"></div><div style="clear: both;">');
	    
	    // close border
	    html.push('</div>');

	    // fill the content
	    target.innerHTML = html.join("");

	    // add the tooltips
	    jQuery('.tt').popover({"trigger": "hover", "html": true, "placement": "bottom"});

	    // show the databases
	    if (! widget.isRecipe) {
		widget.showDatabases();
	    }

	    // create a metagenome selection renderer
	    var result_columns = [ "name", "ID", "project id", "project name", "PI last name", "biome", "feature", "material", "environmental package", "location", "country", "sequencing method" ];
	    var result_attributes = { "ID": "metagenome_id", "project id": "project_id", "project name": "project_name", "PI last name": "PI_lastname","environmental package": "env_package_type", "sequencing method": "seq_method" };

	    var specialFilters = [ { "attribute": "sequence_type", "title": "sequence type", "type": "radio", "options": [ { "value": "all", "title": "all", "checked": true }, { "value": "wgs", "title": "shotgun", "checked": false }, { "value": "amplicon", "title": "amplicon", "checked": false }, { "value": "Metabarcode", "title": "metabarcode", "checked": false }, { "value": "mt", "title": "metatranscriptome", "checked": false } ] }, { "attribute": "retry", "title": "reload<sup title='WARNING: the reload of a profile can take some time' style='cursor: help;'>[?]</sup>", "type": "checkbox", "isOption": true, "options": [ { "value": "1", "title": " ", "checked": false } ] } ];
	    if (stm.user) {
		specialFilters.push( { "attribute": "public", "title": "status", "type": "radio", "options": [ { "value": "all", "title": "all", "checked": true }, { "value": "1", "title": "public", "checked": false }, { "value": "0", "title": "private", "checked": false } ] } );
	    }

	    widget.mgselect = Retina.Renderer.create("listselect", {
		target: document.getElementById("mgselect"),
		headers: stm.authHeader,
		callback: Retina.WidgetInstances.metagenome_analysis[1].loadData,
		asynch_limit: 100,
		synchronous: false,
		navigation_url: RetinaConfig.mgrast_api+'/search?',
		data: [],
		filter: result_columns,
		keyMapping: result_attributes,
		result_field: widget.isRecipe ? false : true,
		result_field_placeholder: "analysis name",
		result_field_default: widget.result_field_default || "",
		multiple: true,
		extra_wide: true,
		return_object: true,
		filter_attribute: 'name',
		filter_type: 'strict',
		specialFilters: specialFilters,
		asynch_filter_attribute: 'name',
		data_manipulation: Retina.WidgetInstances.metagenome_analysis[1].select_manipulation,
		value: "id"
	    }).render();
	    if (widget.recipe && widget.recipe.defaultDatasets && widget.recipe.defaultDatasets.length) {
		widget.mgselect.settings.selection_data = widget.recipe.defaultDatasets;
	    }
	    widget.mgselect.update();
	}
    };

    widget.select_manipulation = function (data) {
	var widget = this;
	
	var result_data = [];

	for (var i=0; i<data.length; i++) {
	    var item = data[i];
	    if (! data[i]['public']) {
	    	data[i].id = Retina.idmap(data[i].metagenome_id);
		data[i].metagenome_id = data[i].id;
	    	data[i].project_id = data[i].project_id ? Retina.idmap(data[i].project_id) : null;
	    } else {
		data[i].id = data[i].metagenome_id;
	    }
	    result_data.push(item);
	}

	return result_data;
    };

    // show the available databases for either protein or RNA
    widget.showDatabases = function () {
	var widget = this;

	var types = [ 'taxonomy', 'hierarchical', 'RNA' ];
	var sourceNameMapping = { "SSU": "Silva SSU", "LSU": "Silva LSU" };
	var sources = {};
	for (var i=0; i<widget.dataLoadParams.sources.length; i++) {
	    sources[sourceNameMapping.hasOwnProperty(widget.dataLoadParams.sources[i]) ? sourceNameMapping[widget.dataLoadParams.sources[i]] : widget.dataLoadParams.sources[i]] = true;
	}
	
	var picked = [];
	var avail = ['<div class="input-append"><select style="width: 125px;" id="dataLoadSourceSelect">'];

	for (var h=0; h<types.length; h++) {
	    avail.push('<optgroup label="'+types[h]+'" style="font-style: normal;padding: 0px 5px 5px 5px;">');
	    for (var i=0; i<widget.sources[types[h]].length; i++) {
		var source = widget.sources[types[h]][i];
		if (sources[source]) {
		    picked.push('<button class="btn btn-small" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeDatabases(\''+source+'\',\'remove\');" title="click to remove datasource">'+source+' &times;</button>');
		} else {
		    avail.push('<option>'+source+'</option>');
		}
	    }
	    avail.push('</optgroup>');
	}
	   
	avail.push('</select><button class="btn" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeDatabases(document.getElementById(\'dataLoadSourceSelect\').options[document.getElementById(\'dataLoadSourceSelect\').selectedIndex].value,\'add\');">add</button></div>');

	document.getElementById('availableDatabases').innerHTML = avail.join("");

	document.getElementById('pickedDatabases').innerHTML = picked.join("");
    };

    widget.changeDatabases = function (db, action) {
	var widget = this;

	if (widget.sourcesNameMapping.hasOwnProperty(db)) {
	    db = widget.sourcesNameMapping[db];
	}
	if (action == 'remove') {
	    var sources = [];
	    for (var i=0; i<widget.dataLoadParams.sources.length; i++) {
		var s = widget.dataLoadParams.sources[i];
		if (s !== db) {
		    sources.push(s);
		}
	    }
	    widget.dataLoadParams.sources = sources;
	} else {
	    widget.dataLoadParams.sources.push(db);
	}

	widget.showDatabases();
    };
    
    widget.loadDone = function (container) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];

	if (container.status == "ready") {
	    var html = "<h3 style='text-align: center;'>Your data is loaded and ready for analysis!</h3>";
	    html += '<div style="cursor: pointer; border: 1px solid rgb(221, 221, 221); border-radius: 6px; box-shadow: 2px 2px 2px; margin-left: auto; margin-right: auto; margin-top: 20px; margin-bottom: 20px; font-weight: bold; height: 75px; width: 75px; text-align: center;" onclick="Retina.WidgetInstances.metagenome_analysis[1].selectedContainer=\''+container.id+'\';Retina.WidgetInstances.metagenome_analysis[1].visualize(Retina.WidgetInstances.metagenome_analysis[1].currentType);document.getElementById(\'dataprogress\').innerHTML=\'\';" class="glow"><img src="Retina/images/bar-chart.png" style="margin-top: 5px; width: 50px;">'+container.id+'</div>';
	    widget.selectedContainer = container.id;
	    var c = stm.DataStore.dataContainer[widget.selectedContainer];
	    
	    var sources = widget.updateSourceMap(c);
	    c.parameters.sources = Retina.keys(sources).sort();
	    c.parameters.displaySource = c.parameters.sources[0];
	    
	    document.getElementById('dataprogress').innerHTML = html;
	    if (! widget.container2matrix()) { return; }
	    widget.showDataContainers();
	} else {
	    document.getElementById('dataprogress').innerHTML = "Your data load was aborted";
	}
    };

    widget.updateSourceMap = function (c) {
	// create a profile - source mapping
	var sourceMap = {};
	var sources = {};
	if (c.items[0].sequence_type == 'otu') {
	    sources = { "otu": true };
	    for (var i=0; i<c.items.length; i++) {
		sourceMap[c.items[i].id] = { "otu": 0 };
	    }
	} else {
	    for (var i=0; i<c.items.length; i++) {
		sourceMap[c.items[i].id] = {};
		for (var h=0; h<c.items.length; h++) {
		    var s = stm.DataStore.profile[c.items[i].id].sources;
		    for (var j=0; j<s.length; j++) {
			sourceMap[c.items[i].id][s[j]] = j;
			sources[s[j]] = true;
		    }
		}
	    }
	}
	c.parameters.sourceMap = sourceMap;
	
	return sources;
    };

    // create a progress div
    widget.pDiv = function (id, done, name, cname) {
	var progressContainer = document.getElementById('dataprogress');
	if (document.getElementById(id)) {
	    return;
	}
	var div = document.createElement('div');
	div.setAttribute('id', id);
	div.setAttribute('class', 'prog');
	div.setAttribute('style', 'margin-left: 15px; float: left; width: 300px;');
	div.innerHTML = '<div style="word-wrap: break-word">'+name+'</div><div><div class="progress'+(done ? '' : ' progress-striped active')+'" style="width: 100px; float: left; margin-right: 5px;"><div class="bar" id="progressbar'+id+'" style="width: '+(done ? '100' : '0' )+'%;"></div></div><div id="progress'+id+'" style="float: left;">'+(done ? "complete." : "waiting for server... <img src='Retina/images/waiting.gif' style='height: 16px; position: relative; bottom: 2px;'><button class='btn btn-mini btn-danger' onclick='Retina.WidgetInstances.metagenome_analysis[1].abortLoad(\""+id+"\", null, \""+cname+"\");' style='margin-left: 5px;'>cancel</button>")+'</div></div>';
	progressContainer.appendChild(div);
    };

    widget.updatePDiv = function (id, status, msg, cname) {
	var target = document.getElementById("progress"+id);
	if (status == 'error') {
	    target.innerHTML = "error: "+msg;
	} else {
	    target.innerHTML = "<span title='updated "+(new Date(Date.now()).toString())+"'>"+status+"... </span><img src='Retina/images/waiting.gif' style='height: 16px; position: relative; bottom: 2px;'><button class='btn btn-mini btn-danger' onclick='Retina.WidgetInstances.metagenome_analysis[1].abortLoad(\""+id+"\", null, \""+cname+"\");' style='margin-left: 5px;'>cancel</button>";
	}
    };

    /*
      DATA LOADING BACKEND
     */

    widget.dataLoadParams = { sources: [ "RefSeq" ] };

    widget.xhr = {};

    // perform a set of API requests and create a data container
    widget.loadData = function (ids, collectionName, params) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];

	ids = jQuery.extend(true, [], ids);
	for (var i=0; i<ids.length; i++) {
	    if (! ids[i].id.match(/^mgm/) && ! stm.DataStore.profile.hasOwnProperty(ids[i].id)) {
		ids[i].id = Retina.idmap(ids[i].id);
	    }
	}

	params = params || widget.isRecipe;
	
	if (! stm.DataStore.hasOwnProperty('dataContainer')) {
	    stm.DataStore.dataContainer = {};
	}	

	var name = widget.isRecipe ? widget.recipe.id : collectionName || widget.dataLoadParams.name || "analysis "+(Retina.keys(stm.DataStore.dataContainer).length + 1);

	if (ids.length) {

	    // add special handling for OTU data
	    if (stm.DataStore.hasOwnProperty('otuprofile')) {
		var valid = true;
		var missing;
		for (var i=0; i<ids.length; i++) {
		    if (! stm.DataStore.otuprofile.hasOwnProperty(ids[i].id)) {
			valid = false;
			missing = ids[i].id;
			break;
		    }
		}
		if (valid) {
		    widget.dataLoadParams.sources = [ "OTU" ];
		} else {
		    alert('You are missing the data for OTU profile '+missing);
		    return;
		}
		widget.cutoffThresholds.evalue = 1;
		widget.cutoffThresholds.identity = 1;
		widget.cutoffThresholds.alilength = 1;
	    }

	    // sanity check if there is a sequence type mix
	    var seqTypes = {};
	    var rna = {};
	    var sourceNameMapping = { "SSU": "Silva SSU", "LSU": "Silva LSU" };
	    for (var i=0; i<widget.sources.RNA.length; i++) {
		rna[widget.sources.RNA[i]] = true;
	    }
	    var hasNonRNA = false;
	    for (var i=0; i<widget.dataLoadParams.sources.length; i++) {
		if (! rna[sourceNameMapping.hasOwnProperty(widget.dataLoadParams.sources[i]) ? sourceNameMapping[widget.dataLoadParams.sources[i]] : widget.dataLoadParams.sources[i]]) {
		    hasNonRNA = true;
		    break;
		}
	    }

	    for (var i=0; i<ids.length; i++) {
		if (ids[i].sequence_type == 'amplicon' && hasNonRNA) {
		    alert('You have chosen a non RNA datasource for an amplicon dataset.\n\nPlease remove either the datasource or the amplicon datasets from your selection.');
		    return;
		}
		if (! seqTypes.hasOwnProperty(ids[i].sequence_type)) {
		    seqTypes[ids[i].sequence_type] = 0;
		}
		seqTypes[ids[i].sequence_type]++;
	    }
	    if (Retina.keys(seqTypes).length > 1) {
		if (! confirm("Your selection is composed of multiple sequence types ("+Retina.keys(seqTypes).join(", ")+").\n\nYou can check the sequence type by selecting it in the filter type. Are you sure you want to load these data?")) {
		    return;
		}
	    }
	    
	    if (stm.DataStore.dataContainer.hasOwnProperty(name) && ! params) {
		if (! confirm("The name '"+name+"' already exists. Do you want \nto replace it with the current selection?")) {
		    return;
		}
	    }
	    document.getElementById('dataprogress').innerHTML = "";
	    if (! params) {
		stm.DataStore.dataContainer[name] = { id: name,
						      items: ids,
						      status: "loading",
						      promises: [],
						      callbacks: [],
						      parameters: { sources: widget.dataLoadParams.sources,
								    hittype: 'rephit',
								    displayLevel: widget.sourceType[widget.dataLoadParams.sources[0]] == "taxonomy" ? "domain" : "level1",
								    displayType: widget.sourceType[widget.dataLoadParams.sources[0]],
								    metadatum: "library|metagenome_name",
								    evalue: widget.cutoffThresholds.evalue,
								    identity: widget.cutoffThresholds.identity,
								    alilength: widget.cutoffThresholds.alilength,
								    abundance: 1,
								    taxFilter: [],
								    ontFilter: [] },
						      visualization: {},
						      created: Retina.date_string(new Date().getTime()),
						      user: stm.user || "anonymous" };
		if (typeof Retina.WidgetInstances.metagenome_analysis[1].loadDone == "function") {
		    stm.DataStore.dataContainer[name].callbacks.push(Retina.WidgetInstances.metagenome_analysis[1].loadDone);
		}
	    }
	    if (widget.isRecipe) {
		var c = stm.DataStore.dataContainer[name];
		c.items = ids;
		c.callbacks = [ function(){
		    var widget = Retina.WidgetInstances.metagenome_analysis[1];
		    if (! widget.container2matrix()) { return; }
		    widget.showCurrentContainerParams();
		    document.getElementById('recipeShowMoreOptions').style.display = "";
		    widget.visualize();
		} ];
		c.promises = [];
		
	    }
	} else {
	    alert('You did not select any metagenomes');
	}
	if (! stm.DataStore.hasOwnProperty('profile') ) {
	    stm.DataStore.profile = {};
	}
	if (! stm.DataStore.hasOwnProperty('inprogress')) {
	    stm.DataStore.inprogress = {};
	}
	for (var i=0;i<ids.length;i++) {

	    // check if this is OTU
	    if (ids[i].sequence_type == "otu") {
		continue;
	    }
	    
	    var id = ids[i].id;
	    
	    // check if the profile is already loaded
	    var needsLoad = true;
	    var missingSources = [];
	    if (stm.DataStore.profile.hasOwnProperty(id)) {

		// there is a profile, check the data sources
		var p = stm.DataStore.profile[id];
		for (var h=0; h<widget.dataLoadParams.sources.length; h++) {
		    var hasSource = false;
		    for (var j=0; j<p.sources.length; j++) {
			if (p.sources[j] == widget.dataLoadParams.sources[h]) {
			    hasSource = true;
			    break;
			}
		    }
		    if (! hasSource) {
			missingSources.push(widget.dataLoadParams.sources[h]);
		    }					  
		}
		if (missingSources.length == 0) {
		    needsLoad = false;
		}
	    } else {
		missingSources = widget.dataLoadParams.sources.slice();
	    }
	    if (needsLoad) {
		for (var h=0; h<missingSources.length; h++) {
		    var source = missingSources[h];
		    if (! stm.DataStore.inprogress.hasOwnProperty('profile'+id+source)) {
			widget.pDiv('profile'+id+source, false, ids[i].name+' '+source, name);
			stm.DataStore.inprogress['profile'+id+source] = 1;
			var recompute = "";
			if (widget.mgselect.settings.specialFilters[1].options[0].checked) {
			    recompute = "&retry=1";
			}
			
			stm.DataStore.dataContainer[name].promises.push(
			    jQuery.ajax({ url: RetinaConfig.mgrast_api + "/profile/" + ids[i].id + "?format=mgrast&condensed=1&verbosity=minimal&source="+source+recompute,
					  dc: name,
					  contentType: 'application/json',
					  headers: stm.authHeader,
					  bound: 'profile'+id+source,
					  success: function (data) {
					      var widget = Retina.WidgetInstances.metagenome_analysis[1];
					      if (data != null) {
						  if (data.hasOwnProperty('ERROR')) {
						      console.log("error: "+data.ERROR);
						      widget.updatePDiv(this.bound, 'error', data.ERROR);
						  } else if (data.hasOwnProperty('status')) {
						      if (data.status == 'done') {
							  widget.downloadComputedData(this.bound, this.dc, data.url);
						      } else {
							  widget.queueDownload(this.bound, data.url, this.dc);
						      }
						  }
					      } else {
						  console.log("error: invalid return structure from API server");
						  console.log(data);
						  widget.updatePDiv(this.bound, 'error', data.ERROR);
					      }
					  },
					  error: function(jqXHR, error) {
					      var errorMsg = "server error";
					      try {
						  errorMsg = JSON.parse(jqXHR.responseText).ERROR;
					      }
					      catch (e) {
						  errorMsg = "server error";
					      }
					      errorMsq = errorMsg.replace(/id \d+\.\d/, "job");
					      Retina.WidgetInstances.metagenome_analysis[1].deleteProgress(this.bound, errorMsg);
					  },
					  complete: function (jqXHR) {
					      Retina.WidgetInstances.metagenome_analysis[1].dataContainerReady(this.dc);
					  }
					}));
		    }
		}
		if (! stm.DataStore.metagenome.hasOwnProperty(ids[i].id) && ! (stm.DataStore.profile.hasOwnProperty(ids[i].id) && stm.DataStore.profile[ids[i].id].hasOwnProperty('metagenome'))) {
		    stm.DataStore.inprogress['profile'+id+'metadata'] = 1;
		    stm.DataStore.dataContainer[name].promises.push(
			jQuery.ajax({ url: RetinaConfig.mgrast_api + "/metagenome/" + ids[i].id + "?verbosity=full",
				      dc: name,
				      contentType: 'application/json',
				      headers: stm.authHeader,
				      bound: "profile"+id+"metadata",
				      metagenome: id,
				      success: function (data) {
					  var widget = Retina.WidgetInstances.metagenome_analysis[1];
					  if (data != null) {
					      if (data.hasOwnProperty('ERROR')) {
						  console.log("error: "+data.ERROR);
						  widget.updatePDiv(this.bound, 'error', data.ERROR);
					      } else if (data.hasOwnProperty('statistics')) {
						  data.metadata.mixs = { "data": data.mixs };

						  // check if this profile has a library name
						  if (! data.metadata.hasOwnProperty('library')) {
						      data.metadata.library = {};
						  }
						  if (! data.metadata.library.hasOwnProperty('data')) {
						      data.metadata.library.data = {};
						  }
						  if (! data.metadata.library.data.metagenome_name) {
						      data.metadata.library.data.metagenome_name = data.name;
						  }
						  
						  // add the metadata
						  if (stm.DataStore.profile.hasOwnProperty(this.metagenome)) {
						      stm.DataStore.profile[this.metagenome].metagenome = data;
						  } else {
						      stm.DataStore.metagenome[this.metagenome] = data;
						  }
					      }
					  } else {
					      console.log("error: invalid return structure from API server");
					      console.log(data);
					  }
				      },
				      error: function(jqXHR, error) {
					  console.log("error: metadata could not be loaded");
				      },
				      complete: function () {
					  Retina.WidgetInstances.metagenome_analysis[1].deleteProgress(this.bound);
					  Retina.WidgetInstances.metagenome_analysis[1].dataContainerReady(this.dc);
				      }
				    }));
		}
	    }
	    else {
		widget.pDiv('profile'+id+source, true, ids[i].name, name);
	    }
	}
	if (ids.length) {
	    Retina.WidgetInstances.metagenome_analysis[1].dataContainerReady(name);
	}

	return;
    };

    widget.queueDownload = function (id, url, name) {
	var widget = this;

	var container = stm.DataStore.dataContainer[name];

	var timeout = stm.DataStore.inprogress[id] > 3 ? 60 : stm.DataStore.inprogress[id] * 10;
	stm.DataStore.inprogress[id]++;
	var sid = id.replace(/^profile/, "");

	widget.xhr[sid] = window.setTimeout(widget.checkDownload.bind(null, id, url, name), timeout * 1000);
    };

    widget.checkDownload = function (id, url, name) {
	return jQuery.ajax({ url: url+"?verbosity=minimal",
			     dc: name,
			     headers: stm.authHeader,
			     contentType: 'application/json',
			     bound: id,
			     success: function (data) {
				 var widget = Retina.WidgetInstances.metagenome_analysis[1];
				 if (data != null) {
				     if (data.hasOwnProperty('ERROR')) {
					 console.log("error: "+data.ERROR);
					 widget.updatePDiv('profile'+this.bound, 'error', data.ERROR);
					 return;
				     } else if (data.hasOwnProperty('status')) {
					 if (data.status == 'done') {
					     widget.downloadComputedData(this.bound, this.dc, data.url);
					 } else {
					     if (data.status != 'submitted' && data.status != 'processing') {
						 widget.updatePDiv(this.bound, 'error', data.status);
						 return;
					     }

					     // check for a stale process
					     var staleTime = 1000 * 60 * 60;
					     if (data.status == 'processing' && new Date(data.progress.updated).getTime() + staleTime < Date.now()) {
						 
						 retry = parseInt(data.retry || 0) + 1;
						 stm.DataStore.dataContainer[this.dc].promises.push(
						     jQuery.ajax({ url: RetinaConfig.mgrast_api + "/profile/" + data.parameters.id + "?format=mgrast&condensed=1&verbosity=minimal&source="+data.parameters.source+"&retry="+retry,
								   dc: this.dc,
								   contentType: 'application/json',
								   headers: stm.authHeader,
								   bound: this.bound,
								   success: function (data) {
								       var widget = Retina.WidgetInstances.metagenome_analysis[1];
								       if (data != null) {
									   if (data.hasOwnProperty('ERROR')) {
									       console.log("error: "+data.ERROR);
									       widget.updatePDiv(this.bound, 'error', data.ERROR);
									   } else if (data.hasOwnProperty('status')) {
									       if (data.status == 'done') {
										   widget.downloadComputedData(this.bound, this.dc, data.url);
									       } else {
										   widget.queueDownload(this.bound, data.url, this.dc);
									       }
									   }
								       } else {
									   console.log("error: invalid return structure from API server");
									   console.log(data);
									   widget.updatePDiv(this.bound, 'error', data.ERROR);
								       }
								   },
								 }));
						 return;
					     }
					     
					     widget.updatePDiv(this.bound, data.status, null, this.dc);
					     widget.queueDownload(this.bound, data.url, this.dc);
					 }
				     }
				 } else {
				     console.log("error: invalid return structure from API server");
				     console.log(data);
				 }
			     },
			     error: function(jqXHR, error) {
				 console.log('check');
				 console.log(jqXHR);
				 var errorMsg = "server error";
				 try {
				     errorMsg = JSON.parse(jqXHR.responseText).ERROR;
				 }
				 catch (e) {
				     errorMsg = "server error";
				 }
				 errorMsq = errorMsg.replace(/id \d+\.\d/, "job");
				 Retina.WidgetInstances.metagenome_analysis[1].deleteProgress(this.bound, errorMsg);
			     },
			     complete: function () {
				 Retina.WidgetInstances.metagenome_analysis[1].dataContainerReady(this.dc);
			     }
			   });
    };

    widget.downloadComputedData = function (id, name, url) {
	var widget = this;

	return jQuery.ajax({ bound: id,
			     url: url,
			     headers: stm.authHeader,
			     dataType: "json",
			     id: id,
			     dc: name,
			     contentType: 'application/json',
			     beforeSend: function (xhr) {
				 xhr.dc = this.dc;
				 Retina.WidgetInstances.metagenome_analysis[1].xhr[this.id] = xhr;
			     },
			     success: function(data) {
				 var widget = Retina.WidgetInstances.metagenome_analysis[1];
				 if (data != null) {
				     if (data.hasOwnProperty('ERROR')) {
					 console.log("error: "+data.ERROR);
				     } else {
					 // check if the profile generation failed
					 if (data.data.hasOwnProperty('ERROR')) {
					     var retry = 1;
					     
					     // check if this has happened before
					     if (data.hasOwnProperty('retry')) {
						 retry = parseInt(data.retry) + 1;
					     }
					     
					     // now send a retry request
					     stm.DataStore.dataContainer[this.dc].promises.push(
						 jQuery.ajax({ url: RetinaConfig.mgrast_api + "/profile/" + data.parameters.id + "?format=mgrast&condensed=1&verbosity=minimal&source="+data.parameters.source+"&retry="+retry,
							       dc: this.dc,
							       contentType: 'application/json',
							       headers: stm.authHeader,
							       bound: this.bound,
							       success: function (data) {
								   var widget = Retina.WidgetInstances.metagenome_analysis[1];
								   if (data != null) {
								       if (data.hasOwnProperty('ERROR')) {
									   console.log("error: "+data.ERROR);
									   widget.updatePDiv(this.bound, 'error', data.ERROR);
								       } else if (data.hasOwnProperty('status')) {
									   if (data.status == 'done') {
									       widget.downloadComputedData(this.bound, this.dc, data.url);
									   } else {
									       widget.queueDownload(this.bound, data.url, this.dc);
									   }
								       }
								   } else {
								       console.log("error: invalid return structure from API server");
								       console.log(data);
								       widget.updatePDiv(this.bound, 'error', data.ERROR);
								   }
							       },
							     }));
					     return;
					 } else {
					     data.data.size = data.size;
					     stm.DataStore.profile[data.data.id+"_load_"+data.data.source] = data.data;
					     widget.purgeProfile(data.data.id, data.data.source);
					     if (stm.DataStore.metagenome.hasOwnProperty(data.data.id)) {
						 stm.DataStore.profile[data.data.id].metagenome = jQuery.extend(true, {}, stm.DataStore.metagenome[data.data.id]);
						 delete stm.DataStore.metagenome[data.data.id];
					     }
					 }
				     }
				 } else {
				     console.log("error: invalid return structure from API server");
				     console.log(data);
				 }
				 Retina.WidgetInstances.metagenome_analysis[1].deleteProgress(this.bound);
				 Retina.WidgetInstances.metagenome_analysis[1].dataContainerReady(this.dc);
			     },
			     error: function(jqXHR, error) {
				 Retina.WidgetInstances.metagenome_analysis[1].abortLoad(this.bound, error, this.dc);
				 Retina.WidgetInstances.metagenome_analysis[1].deleteProgress(this.bound);
				 Retina.WidgetInstances.metagenome_analysis[1].dataContainerReady(this.dc);
			     },
			     xhr: function() {
				 var xhr = new window.XMLHttpRequest();
				 xhr.bound = this.bound;
				 xhr.addEventListener("progress", function(evt){
				     var display = document.getElementById('progress'+this.bound);
				     if (display) {
					 if (evt.lengthComputable) {
					     var bar = document.getElementById('progressbar'+this.bound);
					     bar.parentNode.setAttribute('class', 'progress')
					     var percentComplete = parseInt(evt.loaded / evt.total * 100);
					     display.innerHTML = evt.loaded.byteSize();
					     bar.style.width = percentComplete +"%";
					 } else {
					     display.innerHTML = evt.loaded.byteSize();
					 }
				     }
				 }, false); 
				 return xhr;
			     }
			   });
    };

    widget.deleteProgress = function (id, error) {
	var widget = this;

	delete stm.DataStore.inprogress[id];
	var bar = document.getElementById('progressbar'+id);
	if (bar) {
	    if (error) {
		document.getElementById('progress'+id).innerHTML = "could not load profile - "+error;
		bar.setAttribute('class', 'bar bar-danger');
	    } else {
		document.getElementById('progress'+id).innerHTML += " - complete.";
		bar.setAttribute('class', 'bar bar-success');
	    }
	    bar.parentNode.setAttribute('class', 'progress');
	    bar.parentNode.style.marginBottom = "5px";
	    bar.style.width = '100%';
	}
    };
    
    widget.abortLoad = function (id, abort, name) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];

	var sid = id.replace(/^profile/, "");
	var k = Retina.keys(widget.xhr);
	for (var i=0; i<k.length; i++) {
	    if (typeof widget.xhr[k[i]] == 'number') {
		window.clearTimeout(widget.xhr[k[i]]);
	    } else {
		widget.xhr[k[i]].abort();
	    }
	}
	var container = stm.DataStore.dataContainer[name];
	widget.xhr = [];
	container.promises = [];
	stm.DataStore.inprogress = {};
	
	Retina.WidgetInstances.metagenome_analysis[1].dataContainerReady(container.id, abort || "aborted by user");
    };

    /*
      EXPORT FUNCTIONS
     */
    widget.exportData = function (type) {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];

	if (! widget.selectedContainer) {
	    alert('you currently have no data selected');
	    return;
	}

	if (type == 'png') {
	    // set the output div
	    var resultDiv = document.createElement('div');
	    resultDiv.setAttribute('style', 'display: none;');
	    resultDiv.setAttribute('id', 'canvasResult');
	    document.body.appendChild(resultDiv);
	    
	    // the image is svg
	    if (document.getElementsByClassName('hasSVG').length) {
		var source = document.getElementsByClassName('hasSVG')[0].firstChild;
		var wh = source.getAttribute('viewBox');
		source.setAttribute('width', wh.split(" ")[2]);
		source.setAttribute('height', wh.split(" ")[3]);
		Retina.svg2png(null, resultDiv, wh.split(" ")[2], wh.split(" ")[3]).then(
		    function() {
			Retina.WidgetInstances.metagenome_analysis[1].saveCanvas();
			source.removeAttribute('width');
			source.removeAttribute('height');
		    });
	    }
	    // the image is html
	    else {
		var source = document.getElementById('visualizeTarget').childNodes[1];
		html2canvas(source, {
		    onrendered: function(canvas) {
			document.getElementById('canvasResult').appendChild(canvas);
			Retina.WidgetInstances.metagenome_analysis[1].saveCanvas();
		    }
		});
	    }
	} else if (type == 'svg') {
	    // the image is svg
	    if (document.getElementById('SVGdiv1')) {
		stm.saveAs(document.getElementById('SVGdiv1').innerHTML, widget.selectedContainer + ".svg");
	    } else {
		alert('this feature is not available for this view');
	    }
	} else if (type == 'tsv') {
	    var exportData = widget.container2table(null, true);
	    var exportString = [];
	    exportString.push(exportData.header.join("\t"));
	    for (var i=0; i<exportData.data.length; i++) {
		exportString.push(exportData.data[i].join("\t"));
	    }
	    stm.saveAs(exportString.join("\n"), widget.selectedContainer + ".tsv");
	    return;
	} else if (type == 'tsv_aeap') {
	    var exportData = widget.container2table(null, null, true);
	    var exportString = [];
	    exportString.push(exportData.header.join("\t"));
	    for (var i=0; i<exportData.data.length; i++) {
		exportString.push(exportData.data[i].join("\t"));
	    }
	    stm.saveAs(exportString.join("\n"), widget.selectedContainer + ".tsv");
	    return;
	} else if (type == 'shock') {
	    if (stm.user) {
		widget.createAnalysisObject();
	    } else {
		alert('you must be logged in to use this function');
	    }
	} else if (type == 'biom') {
	    var bioms = widget.container2biom();
	    for (var i=0; i<bioms.length; i++) {
		stm.saveAs(JSON.stringify(bioms[i]), stm.DataStore.dataContainer[widget.selectedContainer].items[i].name+".biom");
	    }
	} else if (type == 'biom_abu') {
	    var bioms = widget.container2biom(null, true);
	    stm.saveAs(JSON.stringify(bioms[0]), widget.selectedContainer+".biom");
	}
    };

    widget.downloadFASTA = function () {
	var widget = this;

	var md5s = widget.container2matrix(null, true);
	if (! md5s) { return; }
	var c = stm.DataStore.dataContainer[widget.selectedContainer];

	for (var i=0; i<c.items.length; i++) {
	    var doc = document.createElement('form');
	    doc.setAttribute('method', 'post');
	    doc.setAttribute('target', '_blank');
	    doc.setAttribute('action', RetinaConfig.mgrast_api + "/annotation/sequence/"+c.items[i].id);
	    doc.setAttribute('enctype',"multipart/form-data");
	    var f = document.createElement('input');
	    f.setAttribute('type', 'text');
	    f.setAttribute('name', 'POSTDATA');
	    f.setAttribute('value', JSON.stringify({"browser":true,"type":"all","format":"fasta","source":c.displaySource,"md5s":md5s[c.items[i].id]}));
	    doc.appendChild(f);
	    var b = document.createElement('input');
	    b.setAttribute('type', 'text');
	    b.setAttribute('name', 'browser');
	    b.setAttribute('value', '1');
	    doc.appendChild(b);
	    var h = document.createElement('input');
	    h.setAttribute('type', 'text');
	    h.setAttribute('name', 'auth');
	    h.setAttribute('value', stm.authHeader.Authorization);
	    doc.appendChild(h);
	    document.body.appendChild(doc);
	    doc.submit();
	    document.body.removeChild(doc);
	}
    };
    
    widget.saveCanvas = function () {
	var widget = Retina.WidgetInstances.metagenome_analysis[1];

	// create the href and click it
	var href = document.createElement('a');
	var canvas = document.getElementById('canvasResult').children[0];
	href.setAttribute('href', canvas.toDataURL());
	href.setAttribute('download', widget.selectedContainer + ".png");
	href.setAttribute('style', 'display: none;');
	document.body.appendChild(href);
	href.click();

	// remove the elements
	document.body.removeChild(href);
	document.body.removeChild(document.getElementById('canvasResult'));
    };

    /* 
       Recipes
    */

    // show the editor dialog
    widget.showRecipeEditor = function () {
	var widget = this;

	var html = [];

	var image;
	if (document.getElementById('SVGdiv1')) {
	    html.push("<div style='width: 200px; height: 200px; margin-left: auto; overflow: hidden; margin-right: auto; border: 1px solid gray; margin-bottom: 10px;'>"+document.getElementById('SVGdiv1').innerHTML+"</div>");
	} else if (document.getElementById('visualizeTarget')) {
	    var div = document.getElementById('visualizeTarget').childNodes[1];
	    html.push("<div style='width: 200px; height: 200px; overflow: hidden; margin-left: auto; margin-right: auto; border: 1px solid gray; margin-bottom: 10px;'><div style='transform-origin: 0px 0px 0px; transform: scale("+(200/parseInt(div.offsetWidth))+"); position: absolute;'>"+div.innerHTML+"</div></div>");
	}

	html.push("<table>");
	html.push("<tr><td style='vertical-align: top;'>name</td><td><input type='text' id='recipeName' placeholder='name of the recipe' style='width: 360px;'></td></tr>");
	html.push("<tr><td style='vertical-align: top;'>categories</td><td><input type='text' id='recipeCategories' placeholder='comma separated list of categories' style='width: 360px;'></td></tr>");
	html.push("<tr><td style='vertical-align: top;'>stars</td><td><select id='recipeStars' style='width: 360px;'><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></td></tr>");
	html.push("<tr><td style='vertical-align: top; padding-right: 20px;'>short description</td><td><textarea style='width: 360px; height: 90px;' id='recipeShortDescription' placeholder='a short description of what this recipe does'></textarea></td></tr>");
	html.push("<tr><td style='vertical-align: top; padding-right: 20px;'>description</td><td><textarea style='width: 360px; height: 90px;' id='recipeDescription' placeholder='a detailed description of the recipe'></textarea></td></tr>");
	html.push("<tr><td style='vertical-align: top; padding-right: 20px;'>keep datasets</td><td><input type='checkbox' style='position: relative; bottom: 3px;' id='recipeKeepDatasets'></td></tr>");
	html.push("<tr><td style='vertical-align: top; padding-right: 20px;'>controls</td><td>taxonomy select <input type='checkbox' id='recipeTaxSelect' style='position: relative; bottom: 3px;'><br>recipe ontology select <input type='checkbox' id='recipeOntSelect' style='position: relative; bottom: 3px;'><br>e-value <input type='checkbox' id='recipeEvalue' style='position: relative; bottom: 3px;'><br>%-identity <input type='checkbox' id='recipeIdentity' style='position: relative; bottom: 3px;'><br>alignment length <input type='checkbox' id='recipeAlilen' style='position: relative; bottom: 3px;'><br>min. abundance <input type='checkbox' id='recipeAbundance' style='position: relative; bottom: 3px;'></td></tr>");
	html.push("</table>");

	document.getElementById('recipeModalContent').innerHTML = html.join('');
	
	jQuery('#recipeModal').modal('show');
    };

    // download / upload the recipe
    widget.createRecipe = function (download) {
	var widget = this;

	if (! download && ! stm.user) {
	    alert('you must be logged in to upload to myData');
	    return;
	}
	
	// get the current container
	var c = jQuery.extend(true, {}, stm.DataStore.dataContainer[widget.selectedContainer]);

	// remove data that has no use in a recipe
	delete c.callbacks;
	delete c.promises;
	delete c.status;
	delete c.items;
	delete c.matrix;
	c.parameters.sourceMap = {};

	// add the current visualization as image
	if (document.getElementById('SVGdiv1')) {
	    c.image = document.getElementById('SVGdiv1').innerHTML;
	} else if (document.getElementById('visualizeTarget')) {
	    var div = document.getElementById('visualizeTarget').childNodes[1];
	    c.image = "<div style='transform-origin: 0px 0px 0px; transform: scale("+(200/parseInt(div.offsetWidth))+"); position: absolute;'>"+div.innerHTML+"</div>";
	}

	// check the parameters from the editor
	var name = document.getElementById('recipeName').value;
	var description = document.getElementById('recipeDescription').value;
	var shortdescription = document.getElementById('recipeShortDescription').value;
	var categories = document.getElementById('recipeCategories').value;
	categories = categories.replace(/\s*,\s*/g, ",").split(/,/);
	var keywords = {};
	for (var i=0; i<categories.length; i++) {
	    keywords[categories[i]] = true;
	}
	
	if (name.length == 0 || description.length == 0 || shortdescription.length == 0) {
	    alert('you must fill out all fields');
	    return;
	}

	c.name = name;
	c.description = description;
	c.shortdescription = shortdescription;
	c.keywords = keywords;
	c.stars = parseInt(document.getElementById('recipeStars').options[document.getElementById('recipeStars').selectedIndex].value);

	if (document.getElementById('recipeKeepDatasets').checked) {
	    c.defaultDatasets = [];
	    for (var i=0; i<c.items.length; i++) {
		c.defaultDatasets.push({"id": c.items[i].id, "name": c.items[i].name});
	    }
	}
	
	c.newbOptions = [];
	if (document.getElementById('recipeTaxSelect').checked) {
	    c.newbOptions.push({"type":"taxSelect","params":{"level":c.parameters.taxFilter[0].level,"default":c.parameters.taxFilter[0].value}});
	}
	if (document.getElementById('recipeOntSelect').checked) {
	    c.newbOptions.push({"type":"ontSelect","params":{"level":c.parameters.ontFilter[0].level,"source":c.parameters.ontFilter[0].source,"default":c.parameters.ontFilter[0].value}});
	}
	if (document.getElementById('recipeEvalue').checked) {
	    c.newbOptions.push({"type":"evalue","params":{"default":c.parameters.evalue}});
	}
	if (document.getElementById('recipeIdentity').checked) {
	    c.newbOptions.push({"type":"identity","params":{"default":c.parameters.identity}});
	}
	if (document.getElementById('recipeAlilen').checked) {
	    c.newbOptions.push({"type":"alilen","params":{"default":c.parameters.alilength}});
	}
	if (document.getElementById('recipeAbundance').checked) {
	    c.newbOptions.push({"type":"abundance","params":{"default":c.parameters.abundance}});
	}
	
	/*
	  ADMIN ONLY
	 */

	c.author = "MG-RAST"

	/*
	  ADMIN ONLY
	 */
	
	// check where to store the recipe

	// download as file
	if (download) {
	    stm.saveAs(JSON.stringify(c), c.id + ".recipe.json");
	}

	// upload to SHOCK
	else {
	    var w = document.createElement('div');
	    w.setAttribute('style', 'position: fixed;top: 10%;left: 50%;z-index: 1051;width: 561px; height: 610px;margin-left: -280px; opacity: 0.8; background-color: black;');
	    w.setAttribute('id', 'waiter');
	    w.innerHTML ='<div style="width: 32px; margin-left: auto; margin-right: auto; margin-top: 200px;"><img src="Retina/images/loading.gif"></div>';
	    document.body.appendChild(w);
	    
	    var url = RetinaConfig.shock_url+'/node';
	    var attributes = new Blob([ JSON.stringify({ "type": "analysisRecipe", "hasVisualization": "1", "owner": stm.user.id, "container": c }) ], { "type" : "text\/json" });
	    var form = new FormData();
	    form.append('attributes', attributes);
	    jQuery.ajax(url, {
		contentType: false,
		processData: false,
		data: form,
		success: function(data) {
		    jQuery.ajax({ url: RetinaConfig.shock_url+'/node/'+data.data.id+'/acl/public_read',
				  success: function(data) {
				      alert('recipe uploaded');
				      document.body.removeChild(document.getElementById('waiter'));
				      jQuery('#recipeModal').modal('hide');
				  },
				  error: function(jqXHR, error) {
				      Retina.WidgetInstances.metagenome_analysis[1].recipeUploaded(false);
				      alert('recipe upload failed');
				      document.body.removeChild(document.getElementById('waiter'));
				      jQuery('#recipeModal').modal('hide');
				  },
				  crossDomain: true,
				  headers: stm.authHeader,
				  type: "PUT"
				});
		},
		error: function(jqXHR, error){
		    alert('recipe upload caused an error');
		},
		crossDomain: true,
		headers: stm.authHeader,
		type: "POST"
	    });
	}
    };

    // return the recipe container to the original state
    widget.restartRecipe = function () {
	var widget = this;

	document.getElementById('dataprogress').innerHTML = "";
	widget.display();
    };

    // show the recipe in the sidebar
    widget.showRecipe = function (data) {
	var widget = this;

	var description = data.description;

	// parse the keywords
	var keywords = [ [ /\$e-value/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#evalueField\").toggleClass(\"glow\");' onmouseout='$(\"#evalueField\").toggleClass(\"glow\");'>e-value</span>" ],
			 [ /\$\%-identity/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#identityField\").toggleClass(\"glow\");' onmouseout='$(\"#identityField\").toggleClass(\"glow\");'>%-identity</span>" ],
			 [ /alignment length/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#alilenField\").toggleClass(\"glow\");' onmouseout='$(\"#alilenField\").toggleClass(\"glow\");'>alignment length</span>" ],
			 [ /\$minimum abundance/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#abundanceField\").toggleClass(\"glow\");' onmouseout='$(\"#abundanceField\").toggleClass(\"glow\");'>minimum abundance</span>" ],
			 [ /\$hit type/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#hittypeField\").toggleClass(\"glow\");' onmouseout='$(\"#hittypeField\").toggleClass(\"glow\");'>hit type</span>" ],
			 [ /\$source/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#sourceField\").toggleClass(\"glow\");' onmouseout='$(\"#sourceField\").toggleClass(\"glow\");'>source</span>" ],
			 [ /\$type/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#typeField\").toggleClass(\"glow\");' onmouseout='$(\"#typeField\").toggleClass(\"glow\");'>type</span>" ],
			 [ /\$level/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#levelField\").toggleClass(\"glow\");' onmouseout='$(\"#levelField\").toggleClass(\"glow\");'>level</span>" ],
		         [ /\$filter/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#filterField\").toggleClass(\"glow\");' onmouseout='$(\"#filterField\").toggleClass(\"glow\");'>filter</span>" ],
			 [ /\$view/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#visualContainerSpace\").toggleClass(\"glow\");' onmouseout='$(\"#visualContainerSpace\").toggleClass(\"glow\");'>view</span>" ],
			 [ /\$export/g, "<span style='cursor: help; color: blue;' onmouseover='$(\"#exportContainerSpace\").toggleClass(\"glow\");' onmouseout='$(\"#exportContainerSpace\").toggleClass(\"glow\");'>export</span>" ] ];

	for (var i=0; i<keywords.length; i++) {
	    description = description.replace(keywords[i][0], keywords[i][1]);
	}

	// fill the html
	var html = '<h4>'+data.name+'<button class="btn btn-mini pull-right" onclick="Retina.WidgetInstances.metagenome_analysis[1].restartRecipe();" title="select datasets"><i class="icon icon-arrow-left"></i></button></h4><p>'+description+'</p>';

	if (! stm.DataStore.hasOwnProperty('dataContainer')) {
	    stm.DataStore.dataContainer = {};
	}
	stm.DataStore.dataContainer[data.id] = data;
	widget.currentType = data.currentRendererType;
	widget.selectedContainer = data.id;
	widget.dataLoadParams.sources = data.parameters.sources;

	// add the newb controls
	var controlTypes = { 'taxSelect': { 'func': function(params) { jQuery("#newbTaxText").typeahead({"source": stm.DataStore.taxonomy[params.level]});
								       if (params.hasOwnProperty('default')) { document.getElementById("newbTaxText").value = params["default"]; }
								       document.getElementById("newbTaxTextPre").innerHTML = params.level
								       document.getElementById("newbTaxTextButton").setAttribute("onclick", 'Retina.WidgetInstances.metagenome_analysis[1].setFilter(document.getElementById("newbTaxText").value, "'+params.level+'")'); },
					    'html': '<div class="input-append input-prepend"><span class="add-on" id="newbTaxTextPre"></span><input type="text" id="newbTaxText" placeholder="enter tax category"><button class="btn" id="newbTaxTextButton">set</button></div>' },
			     'ontSelect': { 'func': function(params) { jQuery("#newbOntText").typeahead({"source": stm.DataStore.ontology[params.source][params.level]});
								       if (params.hasOwnProperty('default')) { document.getElementById("newbOntText").value = params["default"]; }
								       document.getElementById("newbOntTextPre").innerHTML = params.level
								       document.getElementById("newbOntTextButton").setAttribute("onclick", 'Retina.WidgetInstances.metagenome_analysis[1].setFilter(document.getElementById("newbOntText").value, "'+params.level+'", "'+params.source+'", "ont")'); },
					    'html': '<div class="input-append input-prepend"><span class="add-on" id="newbOntTextPre"></span><input type="text" id="newbOntText" placeholder="enter ontology category"><button class="btn" id="newbOntTextButton">set</button></div>' },
			     'evalue': { 'func': function(params) {if (params.hasOwnProperty('default')) { document.getElementById("newbEvalue").value = params["default"]; }},
					  'html': '<div class="input-append input-prepend"><span class="add-on" style="width: 105px;">e-value</span><input type="text" style="width: 80px;" id="newbEvalue"><button class="btn" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'evalue\', document.getElementById(\'newbEvalue\').value);">set</button></div>' },
			     'alilen': { 'func': function(params) {if (params.hasOwnProperty('default')) { document.getElementById("newbAlilen").value = params["default"]; }},
					  'html': '<div class="input-append input-prepend"><span class="add-on" style="width: 105px;">alignment length</span><input type="text" style="width: 80px;" id="newbAlilen"><button class="btn" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'alilength\', document.getElementById(\'newbAlilen\').value);">set</button></div>' },
			     'identity': { 'func': function(params) {if (params.hasOwnProperty('default')) { document.getElementById("newbIdentity").value = params["default"]; }},
					   'html': '<div class="input-append input-prepend"><span class="add-on" style="width: 105px;">%-identity</span><input type="text" style="width: 80px;" id="newbIdentity"><button class="btn" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'identity\', document.getElementById(\'newbIdentity\').value);">set</button></div>' },
			     'abundance': { 'func': function(params) {if (params.hasOwnProperty('default')) { document.getElementById("newbAbundance").value = params["default"]; }},
					   'html': '<div class="input-append input-prepend"><span class="add-on" style="width: 105px;">min. abundance</span><input type="text" style="width: 80px;" id="newbAbundance"><button class="btn" onclick="Retina.WidgetInstances.metagenome_analysis[1].changeContainerParam(\'abundance\', document.getElementById(\'newbAbundance\').value);">set</button></div>' },
			   };
	
	var controls = [];
	if (data.hasOwnProperty('newbOptions') && data.newbOptions.length) {
	    for (var i=0; i<data.newbOptions.length; i++) {
		controls.push(controlTypes[data.newbOptions[i].type].html);
		
	    }
	    html += controls.join('<br>');
	}
	
	document.getElementById('recipeDisplay').innerHTML = html;

	if (data.hasOwnProperty('newbOptions') && data.newbOptions.length) {
	    for (var i=0; i<data.newbOptions.length; i++) {
		controlTypes[data.newbOptions[i].type].func(data.newbOptions[i].params);
	    }
	}
	
	document.getElementById('recipeTitle').innerHTML = data.name;
    };

    // analysis object export
    widget.createAnalysisObject = function (download) {
	var widget = this;

	// set up the node
	var c = jQuery.extend(true, {}, stm.DataStore.dataContainer[widget.selectedContainer]);
	delete c.callbacks;
	delete c.promises;
	delete c.status;
	delete c.user;
	delete c.parameters.sourceMap;

	// create download
	if (download) {
	    if (document.getElementById('SVGdiv1')) {
		c.image = document.getElementById('SVGdiv1').innerHTML;
	    } else if (document.getElementById('visualizeTarget')) {
		c.image = document.getElementById('visualizeTarget').childNodes[1].innerHTML;
	    }
	    stm.saveAs(JSON.stringify(c), c.id + ".ao.json");
	}

	// upload to SHOCK
	else {
	    
	    // disable the upload button
	    document.getElementById('uploadButton').removeAttribute('onclick');
	    document.getElementById('uploadButton').setAttribute('src', 'Retina/images/waiting.gif');
	    
	    // set up the url
	    var url = RetinaConfig.shock_url+'/node';
	    var attributes = new Blob([ JSON.stringify({ "type": "analysisObject", "hasVisualization": "1", "owner": stm.user.id }) ], { "type" : "text\/json" });

	    // the container must be parsed for keys with . because those cannot be uploaded into SHOCK
	    //, "container": c }) ], { "type" : "text\/json" });

	    var form = new FormData();
	    var filename = widget.selectedContainer;
	    form.append('attributes', attributes);
	    form.append('file_name', filename);
	    var image;
	    if (document.getElementById('SVGdiv1')) {
		image = new Blob([ document.getElementById('SVGdiv1').innerHTML ], { "type" : "image\/svg+xml" });
	    } else if (document.getElementById('visualizeTarget')) {
		image = new Blob([ document.getElementById('visualizeTarget').childNodes[1].innerHTML ], { "type" : "text\/html" });
	    } else {
		alert('you have no active image');
		return;
	    }
	    form.append('upload', image);
	    
	    jQuery.ajax(url, {
		contentType: false,
		processData: false,
		data: form,
		success: function(data) {
		    jQuery.ajax({ url: RetinaConfig.shock_url+'/node/'+data.data.id+'/acl/public_read',
				  success: function(data) {
				      document.getElementById('uploadButton').setAttribute('onclick', 'Retina.WidgetInstances.metagenome_analysis[1].exportData("shock");');
				      document.getElementById('uploadButton').setAttribute('src', 'Retina/images/cloud-upload.png');
				      alert('image uploaded');
				  },
				  error: function(jqXHR, error) {
				      document.getElementById('uploadButton').setAttribute('src', 'Retina/images/cloud-upload.png');
				      document.getElementById('uploadButton').setAttribute('onclick', 'Retina.WidgetInstances.metagenome_analysis[1].exportData("shock");');
				      alert('image upload failed');
				  },
				  crossDomain: true,
				  headers: stm.authHeader,
				  type: "PUT"
				});
		},
		error: function(jqXHR, error){
		    alert('image upload caused an error');
		},
		crossDomain: true,
		headers: stm.authHeader,
		type: "POST"
	    });
	}
    };

    // LOAD BACKGROUND DATA
    widget.loadBackgroundData = function () {
	var widget = this;

	JSZipUtils.getBinaryContent('data/tax.v1.json.zip', function(err, data) {
	    if(err) {
		throw err; // or handle err
	    }
	    var zip = new JSZip();
	    zip.loadAsync(data).then(function(zip) {
		zip.file("taxonomy.json").async("string").then(function (tax) {
	    	    tax = JSON.parse(tax);
		    var out = { "domain": [], "phylum": [], "className": [], "order": [], "family": [], "genus": [], "species": [], "strain": [], "organism": {} };
		    for (var d in tax) {
			if (tax.hasOwnProperty(d)) {
			    for (var p in tax[d]) {
				if (tax[d].hasOwnProperty(p)) {
				    for (var c in tax[d][p]) {
					if (tax[d][p].hasOwnProperty(c)) {
					    for (var o in tax[d][p][c]) {
						if (tax[d][p][c].hasOwnProperty(o)) {
						    for (var f in tax[d][p][c][o]) {
							if (tax[d][p][c][o].hasOwnProperty(f)) {
							    for (var g in tax[d][p][c][o][f]) {
								if (tax[d][p][c][o][f].hasOwnProperty(g)) {
								    for (var s in tax[d][p][c][o][f][g]) {
									if (tax[d][p][c][o][f][g].hasOwnProperty(s)) {
									    for (var str in tax[d][p][c][o][f][g][s]) {
										if (tax[d][p][c][o][f][g][s].hasOwnProperty(str)) {
										    
										    out.organism[tax[d][p][c][o][f][g][s][str]] = [ out.domain.length, out.phylum.length, out.className.length, out.order.length, out.family.length, out.genus.length, out.species.length, out.strain.length ];
										    out.strain.push(str);
										}
									    }
									    out.species.push(s);
									}
								    }
								    out.genus.push(g)
								}
							    }
							    out.family.push(f);
							}
						    }
						    out.order.push(o);
						}
					    }
					    out.className.push(c);
					}
				    }
				    out.phylum.push(p);
				}
			    }
			    out.domain.push(d);
			}
		    }
		    
		    stm.DataStore.taxonomy = out;
		    document.getElementById('data').innerHTML = 'loading ontology data... <img src="Retina/images/waiting.gif" style="width: 16px;">';
		    JSZipUtils.getBinaryContent('data/ont.v1.json.zip', function(err, data) {
			if(err) {
			    throw err; // or handle err
			}
			var zip = new JSZip();
			zip.loadAsync(data).then(function(zip) {
			    zip.file("ontology.json").async("string").then(function (ont) {
	    			ont = JSON.parse(ont);
				var out = { "Subsystems": { "level1": [], "level2": [], "level3": [], "function": [], "id": { } }, "COG": { "level1": [], "level2": [], "function": [], "id": { } }, "NOG": { "level1": [], "level2": [], "function": [], "id": { } }, "KO": { "level1": [], "level2": [], "level3": [], "function": [], "id": { } } };
				for (var o in ont) {
				    if (ont.hasOwnProperty(o)) {
					for (var l1 in ont[o]) {
					    if (ont[o].hasOwnProperty(l1)) {
						for (var l2 in ont[o][l1]) {
						    if (ont[o][l1].hasOwnProperty(l2)) {
							if (o == "NOG" || o == "COG") {
							    for (var func in ont[o][l1][l2]) {
								if (ont[o][l1][l2].hasOwnProperty(func)) {
								    var id = Retina.keys(ont[o][l1][l2][func])[0];
								    out[o]["id"][ont[o][l1][l2][func][id]] = [ out[o]["level1"].length, out[o]["level2"].length, out[o]["function"].length ];
								    out[o]["function"].push(func);
								}
							    }
							} else {							    
							    for (var l3 in ont[o][l1][l2]) {
								if (ont[o][l1][l2].hasOwnProperty(l3)) {
								    for (var func in ont[o][l1][l2][l3]) {
									if (ont[o][l1][l2][l3].hasOwnProperty(func)) {
									    var id = Retina.keys(ont[o][l1][l2][l3][func])[0];
									    out[o]["id"][ont[o][l1][l2][l3][func][id]] = [ out[o]["level1"].length, out[o]["level2"].length, out[o]["level3"].length, out[o]["function"].length ];
									    out[o]["function"].push(func);
									}
								    }
								    out[o]["level3"].push(l3);
								}
							    }
							}
							out[o]["level2"].push(l2)
						    }
						}
						out[o]["level1"].push(l1);
					    }
					}
				    }
				}
				stm.DataStore.ontology = out;
				document.getElementById('data').innerHTML = 'loading filterlists... <img src="Retina/images/waiting.gif" style="width: 16px;">';
				jQuery.getJSON('data/filterlists.json', function(data) {
				    Retina.WidgetInstances.metagenome_analysis[1].filterlists = {};
				    document.getElementById('data').innerHTML = 'creating local store... <img src="Retina/images/waiting.gif" style="width: 16px;">';
				    Retina.WidgetInstances.metagenome_analysis[1].display();
				});
			    });
			});
		    });
		});
	    });
	});
    };

    widget.purgeProfile = function (id, source) {

	// get the profile
	var profile = stm.DataStore.profile[id+"_load_"+source];
	
	// check if this profile is already purged
	if (stm.DataStore.profile.hasOwnProperty(id)) {
	    widget.mergeProfile(id, source);
	    return;
	}
	
	// sort by md5
	profile.data = profile.data.sort(Retina.propSort(0));
	
	// store all in one big array
	var p = [];

	// iterate over the profile data
	for (var h=0; h<profile.data.length; h++) {
	    
	    // store the hit data
	    for (var j=0; j<5; j++) {
		p.push(profile.data[h][j]);
	    }

	    // push the taxon
	    p.push( profile.data[h][5] && profile.data[h][5].length ? (profile.data[h][5].length > 1 ? profile.data[h][5].join(',') : profile.data[h][5][0]) : null );
	    
	    // push the function
	    p.push( profile.data[h][6] && profile.data[h][6].length ? (profile.data[h][6].length > 1 ? profile.data[h][6].join(',') : profile.data[h][6][0]) : null );
	}
	profile.data = p;
	profile.sources = [ profile.source ];
	delete profile.source;
	profile.size = JSON.stringify(profile).length;
	stm.DataStore.profile[id] = jQuery.extend(true, {}, profile);
	delete stm.DataStore.profile[id+"_load_"+source];
    };

    widget.mergeProfile = function (id, source) {
	var widget = this;

	// get the profile
	var profile = stm.DataStore.profile[id+"_load_"+source];
	var previous = stm.DataStore.profile[id];
	
	// new target array
	var p = [];

	// get the previous profile first md5
	var prevind = 0;

	// get the number of cells per row of previous
	var prevrow = 5 + (2 * previous.sources.length);

	// sort by md5
	profile.data = profile.data.sort(Retina.propSort(0));
	
	// iterate over the new profile data
	for (var h=0; h<profile.data.length; h++) {

	    // check if the previous profile md5 is smaller than the current profile md5
	    while (previous.data[prevind] < profile.data[h][0]) {
		for (var j=0; j<prevrow; j++) {
		    p.push(previous.data[prevind + j]);
		}
		
		p.push(null);
		p.push(null);
		
		prevind += prevrow;
	    }

	    // merge the row if existent in both
	    if (previous.data[prevind] == profile.data[h][0]) {

		// push existing
		for (var j=0; j<prevrow; j++) {
		    p.push(previous.data[prevind + j]);
		}

		// push new
		
		// push the taxon
		p.push( profile.data[h][5] && profile.data[h][5].length ? (profile.data[h][5].length > 1 ? profile.data[h][5].join(',') : profile.data[h][5][0]) : null );
		
		// push the function
		p.push( profile.data[h][6] && profile.data[h][6].length ? (profile.data[h][6].length > 1 ? profile.data[h][6].join(',') : profile.data[h][6][0]) : null );
		
		prevind += prevrow;
	    }

	    // if the row is new, push new values
	    else if (previous.data[prevind] > profile.data[h][0]) {

		// store the hit data
		for (var j=0; j<5; j++) {
		    p.push(profile.data[h][j]);
		}

		// push null values for old sources
		for (var j=0; j<previous.sources.length; j++) {
		    p.push(null);
		    p.push(null);
		}
		
		// add new

		// push the taxon
		p.push( profile.data[h][5] && profile.data[h][5].length ? (profile.data[h][5].length > 1 ? profile.data[h][5].join(',') : profile.data[h][5][0]) : null );
		
		// push the function
		p.push( profile.data[h][6] && profile.data[h][6].length ? (profile.data[h][6].length > 1 ? profile.data[h][6].join(',') : profile.data[h][6][0]) : null );
	    }
	}

	// add the remaining values from the old source
	for (var i=prevind; i<previous.data.length; i+=prevrow) {
	    for (var j=0; j<prevrow; j++) {
		p.push(previous.data[prevind + j]);
	    }
	    
	    p.push(null);
	    p.push(null);    
	}
	
	// add the new source
	previous.sources.push(profile.source);
	
	// set the data of the merged profile
	previous.data = p;

	previous.row_total = p.length / (5 + (previous.sources.length * 2));

	previous.size = JSON.stringify(previous).length;

	// delete the loaded additional data
	delete stm.DataStore.profile[id+"_load_"+source];
    };

    widget.loadGraphs = function () {
	var widget = this;

	var graphs = [ "pie", "donut", "stackedBar", "bar", "heatmap", "rarefaction", "pca", "differential" ];
	for (var i=0; i<graphs.length; i++) {
	    jQuery.ajax({ url: 'data/graphs/'+graphs[i]+'.json',
			  contentType: 'application/json',
			  graph: graphs[i],
			  complete: function (xhr) {
			      var widget = Retina.WidgetInstances.metagenome_analysis[1];
			      
			      widget.graphs[this.graph] = JSON.parse(xhr.responseText);
			  }
			});
	}
    };

    /*
      LOADED PROFILES
     */
    widget.enableLoadedProfiles = function () {
	var widget = this;

	var html = [ '<div class="btn-group"><a class="btn dropdown-toggle btn-small" data-toggle="dropdown" href="#"><i class="icon icon-folder-open" style=" margin-right: 5px;"></i>add loaded profiles <span class="caret"></span></a><ul class="dropdown-menu">' ];

	html.push('<li><a href="#" onclick="Retina.WidgetInstances.metagenome_analysis[1].addLoadedProfile(null, true); return false;"><i>- all -</i></a></li>');
	
	var profs = Retina.keys(stm.DataStore.profile).sort();
	for (var i=0; i<profs.length; i++) {
	    html.push('<li><a href="#" onclick="Retina.WidgetInstances.metagenome_analysis[1].addLoadedProfile(\''+profs[i]+'\'); return false;">'+profs[i]+'</a></li>');
	}

	html.push('</ul></div>');

	if (profs.length) {
	    document.getElementById('loadedProfileSpace').innerHTML = html.join("");
	}

	if (stm.DataStore.hasOwnProperty('otuprofile')) {
	    html = [ '<div class="btn-group"><a class="btn dropdown-toggle btn-small" data-toggle="dropdown" href="#"><i class="icon icon-folder-open" style=" margin-right: 5px;"></i>add loaded profiles <span class="caret"></span></a><ul class="dropdown-menu">' ];
	    
	    html.push('<li><a href="#" onclick="Retina.WidgetInstances.metagenome_analysis[1].addLoadedOTUProfile(null, true); return false;"><i>- all -</i></a></li>');
	
	    profs = Retina.keys(stm.DataStore.otuprofile).sort();
	    for (var i=0; i<profs.length; i++) {
		html.push('<li><a href="#" onclick="Retina.WidgetInstances.metagenome_analysis[1].addLoadedOTUProfile(\''+profs[i]+'\'); return false;">'+profs[i]+'</a></li>');
	    }
	    
	    html.push('</ul></div>');

	    if (profs.length) {
		document.getElementById('loadedOTUProfileSpace').innerHTML = html.join("");
	    }
	}
    };

    widget.addLoadedProfile = function (name, all) {
	var widget = this;

	var r = widget.mgselect;
	var mgs = [];
	if (all) {
	    mgs = Retina.keys(stm.DataStore.profile).sort();
	} else {
	    mgs = [ name ]
	}

	for (var i=0; i<mgs.length; i++) {
	    stm.DataStore.profile[mgs[i]].metagenome.mixs.name = stm.DataStore.profile[mgs[i]].metagenome.name;
	    stm.DataStore.profile[mgs[i]].metagenome.mixs.id = stm.DataStore.profile[mgs[i]].metagenome.id;
	    var obj = jQuery.extend(true, {}, stm.DataStore.profile[mgs[i]].metagenome.mixs);
	    r.settings.selection_data.push(obj);
	    r.settings.selection[name] = 1;
	}
	
	r.redrawResultlist(r.result_list);
    };

    widget.addLoadedOTUProfile = function (name, all) {
	var widget = this;

	var r = widget.mgselect;
	var mgs = [];
	if (all) {
	    mgs = Retina.keys(stm.DataStore.otuprofile).sort();
	} else {
	    mgs = [ name ]
	}

	for (var i=0; i<mgs.length; i++) {
	    r.settings.selection_data.push({name: mgs[i], id: mgs[i], sequence_type: "otu" });
	    r.settings.selection[name] = 1;
	}
	
	r.redrawResultlist(r.result_list);
    };

    /*
      COLLECTIONS
     */
    widget.enableCollections = function () {
	var widget = this;

	var html = [ '<div class="btn-group"><a class="btn dropdown-toggle btn-small" data-toggle="dropdown" href="#"><img style="height: 16px; margin-right: 5px;" src="Retina/images/cart.png">add collection <span class="caret"></span></a><ul class="dropdown-menu">' ];

	var colls = Retina.keys(stm.user.preferences.collections).sort();
	for (var i=0; i<colls.length; i++) {
	    html.push('<li><a href="#" onclick="Retina.WidgetInstances.metagenome_analysis[1].addCollection(\''+colls[i]+'\'); return false;">'+colls[i]+'</a></li>');
	}

	html.push('</ul></div>');

	document.getElementById('collectionSpace').innerHTML = html.join("");	
    };

    widget.addCollection = function (name) {
	var widget = this;

	var c = stm.user.preferences.collections[name];
	var r = widget.mgselect;
	var mgs = Retina.keys(c.metagenomes);	
	for (var i=0; i<mgs.length; i++) {
	    var obj = { "name": c.metagenomes[mgs[i]], "biome": "", "feature": "", "material": "", "location": "", "country": "", "id": mgs[i], "project_id": "", "project_name": "", "PI_lastname": "", "env_package_type": "", "seq_method": ""};
	    r.settings.selection_data.push(obj);
	    r.settings.selection[mgs[i]] = 1;
	}
	r.redrawResultlist(r.result_list);
    };
    
    /*
      PLUGINS
    */

    // open a window for the plugin, pass the data and initialize it
    widget.plugin = function (which) {
	var widget = this;

	var info = {
	    "krona": { "authors": "Ondov BD, Bergman NH, and Phillippy AM", "publication": "http://www.ncbi.nlm.nih.gov/pubmed/21961884" },
	    "kegg": { "authors": "Tobias Paczian" },
	    "cytoscape": { "authors": "Franz M, Lopes CT, Huck G, Dong Y, Sumer O, Bader GD", "publication": "http://www.ncbi.nlm.nih.gov/pubmed/26415722" },
	    "listmaker": { "authors": "Tobias Paczian" }
	};
	
	var d = widget["container2"+which]();
	if (! d) {
	    return;
	}
	
	var data = { "plugin": which,
		     "info": info[which],
		     "transfer": d };

	var w = window.open('plugin.html');
	w.onload = function () {
	    w.initWebApp(data);
	};
    };

    widget.container2cytoscape = function () {
	var widget = this;

	// get the data matrix
	var c = jQuery.extend(true, {}, stm.DataStore.dataContainer[widget.selectedContainer]);
	var l = c.hierarchy[Retina.keys(c.hierarchy)[0]].length;

	var data = [];
	var colors = GooglePalette(l);
	var elements = [ { "data": { "id": 0, "weight": 1, "name": "root", "color": "black" } }];
	var idcounter = 1;
	var total = 0;
	for (var h=0; h<l; h++) {
	    data[h] = {};
	    for (var i=0; i<c.matrix.rows.length; i++) {
		var name = c.hierarchy[c.matrix.rows[i]][h].replace(/'/g, "").replace(/"/g, "");
		if (! data[h].hasOwnProperty(name)) {
		    data[h][name] = { "data": { "id": idcounter, "weight": 0, "origWeight": 0, "name": name, "color": colors[h] } };
		    if (h>0) {
			data[h][name].data.parentName = c.hierarchy[c.matrix.rows[i]][h -1];
		    }
		    idcounter++;
		    if (h==0) {
			elements.push({ "data": { "id": idcounter, "source": 0, "target": idcounter - 1, "color": "black" }});
			idcounter++;
		    }
		}
		data[h][name].data.weight += c.matrix.data[i][0];
		data[h][name].data.origWeight += c.matrix.data[i][0];
		if (h==0) {
		    total += c.matrix.data[i][0];
		}
		if (h>0) {
		    elements.push({ "data": { "id": idcounter, "source": data[h - 1][c.hierarchy[c.matrix.rows[i]][h -1]].data.id, "target": data[h][name].data.id, "color": "black" }});
		    idcounter++;
		}
	    }
	}

	for (var h=0; h<l; h++) {
	    var nodes = Retina.keys(data[h]);
	    for (var i=0; i<nodes.length; i++) {
		var factor = 100 / total;
		if (h>0) {
		    factor = 100 / data[h - 1][data[h][nodes[i]].data.parentName].data.origWeight;
		}
		data[h][nodes[i]].data.weight = data[h][nodes[i]].data.weight * factor;
		data[h][nodes[i]].data.weight = data[h][nodes[i]].data.weight < 10 ? 10 : data[h][nodes[i]].data.weight;
		elements.push(data[h][nodes[i]]);
	    }
	}

	return { "elements": elements, "title": widget.selectedContainer };
    };

    widget.container2kegg = function () {
	var widget = this;

	var container = jQuery.extend(true, {}, stm.DataStore.dataContainer[widget.selectedContainer]);
	var hasKO = false;
	var koSource = 0;
	for (var i=0; i<container.parameters.sources.length; i++) {
	    if (container.parameters.sources[i] == "KO") {
		hasKO = true;
		koSource = i;
		break;
	    }
	}
	if (! hasKO) {
	    alert("Your container must include the KO source to use the KEGG Mapper");
	    return false;
	}

	// set the correct parameters
	container.parameters.displayType = "function";
	container.parameters.displayLevel = "function";
	container.parameters.displaySource = "KO";

	// get the functions
	var c = widget.container2matrix(container);
	if (! c) {
	    return;
	}
	var funcs = jQuery.extend(true, {}, c.matrix);

	container.parameters.displayLevel = "level3";
	
	// get the maps
	c = widget.container2matrix(container);
	if (! c) {
	    return;
	}
	var maps = jQuery.extend(true, {}, c.matrix);
	
	var data = { "functions": funcs, "maps": maps };
	
	return data;
    };

    widget.container2krona = function () {
	var widget = this;

	var container = stm.DataStore.dataContainer[widget.selectedContainer];
	var ranks = container.parameters.displayType == "taxonomy" ? widget.taxLevels.slice(0, container.parameters.depth) : widget.ontLevels[container.parameters.displaySource].slice(0, container.parameters.depth);
	var matrixdata = [];
	for (var i=0; i<container.matrix.cols.length; i++) {
	    matrixdata.push([]);
	    for (var h=0; h<container.matrix.data.length; h++) {
		var row = [];
		for (var j=0;j<ranks.length; j++) {
		    row.push(container.hierarchy[container.matrix.rows[h]][j]);
		}
		row.push(container.matrix.data[h][i]);
		row.push(container.matrix.evalues[h][i]);
		matrixdata[i].push(row);
	    }
	}

	if (ranks[2] == "className") { ranks[2] = "class"; }
	
	var data = { "ranks": ranks,
		     "names": container.matrix.cols,
		     "data": matrixdata,
		     "containerName": container.id };
	return data;
    };

    widget.container2listmaker = function () {
	var widget = this;

	var c = stm.DataStore.dataContainer[widget.selectedContainer];

	if (! stm.DataStore.functionMap) {
	    stm.DataStore.functionMap = [];
	}

	var functions = {};
	for (var i=0; i<c.items.length; i++) {
	    var smid = c.parameters.sourceMap[c.items[i].id].RefSeq;
	    if (smid != null) {
		var pid = c.items[i].id;
    		var p = stm.DataStore.profile[pid];
		var rl = 5 + (p.sources.length * 2);
		for (var h=0; h<p.data.length; h+=rl) {
		    var funcs = p.data[h + 6 + (smid * 2)];
		    if (funcs == null) {
			continue;
		    } else if (typeof funcs == "number") {
			funcs = [ funcs ];
		    } else if (typeof funcs == "string") {
			funcs = funcs.split(",");
		    }
		    for (var k=0; k<funcs.length; k++) {
			if (! stm.DataStore.functionMap.hasOwnProperty(funcs[k])) {
			    functions[funcs[k]] = true;
			}
		    }
		}
		if (! c.items[i].functionsLoaded) {
		    c.items[i].functionsLoaded = true;
		}
	    }
	}

	var x = Retina.keys(functions).sort();
	functions = [];
	for (var i=0; i<x.length; i++) {
	    functions.push(parseInt(x[i]));
	}

	if (functions.length) {
	    jQuery("[title='List Generator']")[0].setAttribute('onclick', '');
	    jQuery("[title='List Generator']")[0].setAttribute('src', 'Retina/images/loading.gif');
	    jQuery.ajax({
		url: RetinaConfig.mgrast_api + '/m5nr/function_id',
		method: 'POST',
		data: '{"data":'+JSON.stringify(functions)+'}',
		success: function (result) {
		    for (var i=0; i<result.data.length; i++) {
			stm.DataStore.functionMap[result.data[i].function_id] = result.data[i]['function'];
		    }
		    Retina.WidgetInstances.metagenome_analysis[1].plugin('listmaker');
		    jQuery("[title='List Generator']")[0].setAttribute('onclick', 'Retina.WidgetInstances.metagenome_analysis[1].plugin("listmaker")');
		    jQuery("[title='List Generator']")[0].setAttribute('src', 'Retina/images/table.png');
		}
	    });
	    
	    return false;
	} else {
	    return true;
	}
    };

    /* Help texts */
    widget.help = { "distance metrics":
		    { "euclidean": "https://en.wikipedia.org/wiki/Euclidean_distance",
		      "minkowski": "https://en.wikipedia.org/wiki/Minkowski_distance",
		      "canberra": "https://en.wikipedia.org/wiki/Canberra_distance",
		      "manhattan": "https://xlinux.nist.gov/dad/HTML/manhattanDistance.html",
		      "maximum": "",
		      "braycurtis": "https://en.wikipedia.org/wiki/Qualitative_variation",
		      "jaccard": "https://en.wikipedia.org/wiki/Qualitative_variation" }
		  };

    widget.getFunctionIndices = function () {
	var widget = this;

	var c = stm.DataStore.dataContainer[widget.selectedContainer];

	var functions = {};

	for (var i=0; i<c.items.length; i++) {
	    var smid = c.parameters.sourceMap[c.items[i].id].RefSeq;
	    if (smid != null) {
		var pid = c.items[i].id;
    		var p = stm.DataStore.profile[pid];
		var rl = 5 + (p.sources.length * 2);
		for (var h=0; h<p.data.length; h+=rl) {
		    var funcs = p.data[h + 6 + (smid * 2)];
		    if (funcs == null) {
			continue;
		    } else if (typeof funcs == "number") {
			funcs = [ funcs ];
		    } else if (typeof funcs == "string") {
			funcs = funcs.split(",");
		    }
		    for (var k=0; k<funcs.length; k++) {
			functions[funcs[k]] = true;
		    }
		}
	    }
	}

	var x = Retina.keys(functions).sort();
	functions = [];
	for (var i=0; i<x.length; i++) {
	    functions.push(parseInt(x[i]));
	}

	window.selfuncs = functions;
    };

    widget.resolveFunctionIndices = function (list) {
	var widget = this;

	jQuery.ajax({
	    url: RetinaConfig.mgrast_api+"/m5nr/function_id",
	    method: 'POST',
	    data: '{"data":'+JSON.stringify(list)+'}',
	    success: function (result) {
		console.log(result);
	    }
	});
    };
    
})();
