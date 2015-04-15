(function () {
    widget = Retina.Widget.extend({
        about: {
                title: "Metagenome Overview Widget",
                name: "metagenome_overview",
                author: "Tobias Paczian",
                requires: [ "rgbcolor.js" ]
        }
    });
    
    widget.setup = function () {
	return [ Retina.load_renderer("listselect"),
	         Retina.load_renderer("paragraph"),
		 Retina.load_renderer("graph"),
		 Retina.load_renderer("plot"),
 		 Retina.load_renderer("table"),
		 Retina.load_widget("mgbrowse"),
		 Retina.load_renderer("pdf")
	       ];
    };
    
    widget.mg_select_list = undefined;
    widget.curr_mg = undefined;
    
    widget.display = function (wparams) {
        widget = this;
	var index = widget.index;

	document.getElementById('icon_publications').firstChild.title = "Metagenome Overview";
	document.getElementById('icon_publications').lastChild.innerHTML = "Metagenome";
	
	if (wparams) {
	    widget.target = wparams.target || wparams.main;
	    widget.sidebar = wparams.sidebar;
	    widget.sidebar.innerHTML = "";
	    widget.target.innerHTML = '\
<div id="mg_modal" class="modal show fade" tabindex="-1" style="width: 500px;" role="dialog">\
  <div class="modal-header">\
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>\
    <h3>Metagenome Selector</h3>\
  </div>\
  <div class="modal-body" style="padding-left: 20px;"><div id="mg_modal_body"><div style="margin-left: auto; margin-right: auto; margin-top: 50px; margin-bottom: 50px; width: 50px;"><img style="" src="Retina/images/waiting.gif"></div></div></div>\
  <div class="modal-footer">\
    <button class="btn btn-danger pull-left" data-dismiss="modal" aria-hidden="true">Cancel</button>\
  </div>\
</div>';
	}

	if (Retina.cgiParam('metagenome')) {
	    widget.id = Retina.cgiParam('metagenome');
	    if (! widget.id.match(/^mgm/)) {
		widget.id = "mgm"+widget.id;
	    }
	}

        // check if id given
        if (widget.id) {
	    widget.sidebar.parentNode.className = "span3 sidebar affix";
	    widget.sidebar.parentNode.style = "right: 8%; background-color: white;";
	    jQuery('#mg_modal').modal('hide');
	    
	    widget.target.innerHTML = '<div style="margin-left: auto; margin-right: auto; margin-top: 300px; width: 50px;"><img style="" src="Retina/images/waiting.gif"></div>';

	    if (stm.DataStore.hasOwnProperty('metagenome') && stm.DataStore.metagenome.hasOwnProperty(widget.id) && stm.DataStore.metagenome[widget.id].hasOwnProperty('computationStatus') && stm.DataStore.metagenome[widget.id].computationStatus == 'incomplete') {
		widget.target.innerHTML = "<div class='alert'>This metagenome has not yet finished analysis.</div>";
		return;
	    }

	    // check if required data is loaded (use stats)
	    if (! stm.DataStore.hasOwnProperty('metagenome') || ! stm.DataStore.metagenome.hasOwnProperty(widget.id) || ! stm.DataStore.metagenome[widget.id].hasOwnProperty('computationStatus')) {
		var url = RetinaConfig.mgrast_api + '/metagenome/'+widget.id+'?verbosity=full';
		jQuery.ajax( { dataType: "json",
			       url: url,
			       headers: stm.authHeader,
			       success: function(data) {
				   if (! stm.DataStore.hasOwnProperty('metagenome')) {
				       stm.DataStore.metagenome = {};
				   }
				   if (data.hasOwnProperty('statistics')) {
				       data.computationStatus = "complete";
				   } else {
				       data.computationStatus = "incomplete";
				   }
				   stm.DataStore.metagenome[data.id] = data;
				   Retina.WidgetInstances.metagenome_overview[1].display();
			       },
			       error: function () {
				   widget.target.innerHTML = "<div class='alert alert-error' style='width: 50%;'>You do not have the permisson to view this data.</div>";
			       }
			     } );
		return;
            }
	    // get id first
        } else {
            widget.metagenome_modal(index, widget.main);
            return;
        }
	
	// make some shortcuts
	widget.curr_mg = stm.DataStore.metagenome[widget.id];
	var content = widget.target;
	var seq_type = widget.curr_mg.sequence_type;
	
	// set the output area
	content.innerHTML = '<a name="home" style="padding-top: 80px;"></a>';
	
	// set style variables
	var header_color = "black";
	var title_color = "black";
	var ont_tbl = document.createElement('table');
	var tax_tbl = document.createElement('table');
	ont_tbl.id = 'ont_tbl';
	tax_tbl.id = 'tax_tbl';
	var outputs = [ 
	    { type: 'paragraph', data: 'general_overview' },
	    { type: 'paragraph', data: 'metagenome_summary' },
	    { type: 'piechart', data: 'summary', category: 'summary' },
	    { type: 'paragraph', data: 'toc_list' },
	    { type: 'paragraph', data: 'piechart_footnote' },
	    { type: 'paragraph', data: 'project_information' },
	    { type: 'paragraph', data: 'analysis_statistics' },
	    { type: 'paragraph', data: 'mixs_metadata' },
	    { type: 'paragraph', data: 'drisee_introtext' },
	    (seq_type == 'Amplicon') ? null : { type: 'plot', data: 'drisee_plot', category: 'drisee' },
	    { type: 'paragraph', data: 'kmer_introtext' },
	    { type: 'plot', data: 'kmer_plot', category: 'kmer' },
	    { type: 'paragraph', data: 'bp_introtext' },
	    { type: 'areagraph', data: 'bp_plot', category: 'bp' },
	    (seq_type == 'Amplicon') ? null : { type: 'paragraph', data: 'ontology_introtext' },
	    (seq_type == 'Amplicon') ? null : { type: 'add_element', data: ont_tbl },
	    (seq_type == 'Amplicon') ? null : { type: 'piechart', data: 'Subsystems', category: 'ontology', pos: 'left' },
	    (seq_type == 'Amplicon') ? null : { type: 'piechart', data: 'KO', category: 'ontology', pos: 'right' },
	    (seq_type == 'Amplicon') ? null : { type: 'piechart', data: 'COG', category: 'ontology', pos: 'left' },
	    (seq_type == 'Amplicon') ? null : { type: 'piechart', data: 'NOG', category: 'ontology', pos: 'right' },
	    { type: 'paragraph', data: 'taxonomy_introtext' },
	    { type: 'add_element', data: tax_tbl },
	    { type: 'piechart', data: 'domain', category: 'taxonomy', pos: 'left' },
	    { type: 'piechart', data: 'phylum', category: 'taxonomy', pos: 'right' },
	    { type: 'piechart', data: 'class', category: 'taxonomy', pos: 'left' },
	    { type: 'piechart', data: 'order', category: 'taxonomy', pos: 'right' },
	    { type: 'piechart', data: 'family', category: 'taxonomy', pos: 'left' },
	    { type: 'piechart', data: 'genus', category: 'taxonomy', pos: 'right' },
	    { type: 'paragraph', data: 'rank_abund_introtext' },
	    { type: 'linegraph', data: 'rank_abund_plot', category: 'rank_abund' },
	    { type: 'paragraph', data: 'rarefaction_introtext' },
	    { type: 'plot', data: 'rarefaction_plot', category: 'rarefaction' },
	    { type: 'title', data: '<a name="metadata_table" style="padding-top: 80px;"></a>Metadata' },
	    { type: 'metadata_table', data: 'metadata_table' }
	];
	
	// iterate over the outputs
	var curr_table = undefined;
	var lastDiv = null;
	for (var out=0;out<outputs.length;out++) {
	    if (! outputs[out]) {
		continue;
	    }
	    if (outputs[out].type == 'add_element') {
	        curr_table = outputs[out].data.id;
	        content.appendChild(outputs[out].data);
	        continue;
	    }
	    // create and append the output div
	    var data, x, y, labels, points, xt, yt, xscale, yscale;
	    var div;
	    if (lastDiv && outputs[out].type == 'paragraph' && outputs[out].data != "toc_list") {
		div = lastDiv;
	    } else {
		lastDiv = null;
		div = document.createElement('div');
	    }
	    var tag = document.createElement('a');
	    tag.setAttribute('name', outputs[out].data);
	    // add div to content or table
	    if (outputs[out].hasOwnProperty('pos') && curr_table) {
	        if (outputs[out].pos == 'left') {
	            jQuery('#'+curr_table).append( jQuery('<tr>').append( jQuery('<td>').css('vertical-align', 'top').append( jQuery(div) )));
	        } else if (outputs[out].pos == 'right') {
	            jQuery('#'+curr_table+' tr').last().append( jQuery('<td>').css('vertical-align', 'top').append( jQuery(div) ) );
	        }
	    } else {
		if (outputs[out].data == "toc_list") {
		    document.getElementById('sidebar').appendChild(tag);
		    document.getElementById('sidebar').appendChild(div);
		} else {
		    //content.appendChild(tag);
		    if (! lastDiv) {
			content.appendChild(div);
		    }
		}
            }
	    if (outputs[out].type == 'paragraph' && outputs[out].data != "toc_list") {
		if (! lastDiv) {
		    lastDiv = div;
		}
	    }
	    
	    // check the type and call the according renderer with the data generated by the defined function
	    switch (outputs[out].type) {
	    case 'title':
	        Retina.Renderer.create("paragraph", {target: div, data: [{header: outputs[out].data}]}).render();
	        break;
	    case 'paragraph':
		data = widget[outputs[out].data](index);
		if (data) {
		    if (outputs[out].data != "analysis_statistics" && outputs[out].data != "mixs_metadata") {
			div.style.display = 'block';
			div.style.clear = 'both';
		    }
		    data.target = div;
		    data.title_color = title_color;
		    data.header_color = header_color;
		    Retina.Renderer.create("paragraph", data).render();
	        } else {
		    //content.removeChild(tag);
		    content.removeChild(div);
		}
		break;
	    case 'piechart':
	        if (outputs[out].data == 'summary') {
	            data = widget.summary_piechart(index);
	            div.setAttribute('class', 'span9');
	        } else {
	            data = widget.annotation_piechart(index, outputs[out].category, outputs[out].data);
	        }
		div.style.display = 'block';
		div.style.clear = 'both';
		data.target = div;
		Retina.Renderer.create("graph", data).render();
		break;
	    case 'linegraph':
		data = widget.taxon_linegraph(index, 'family', 50);
		div.style.display = 'block';
		div.style.clear = 'both';
		data.target = div;
		Retina.Renderer.create("graph", data).render();
            break;
            case 'areagraph':
		if (! widget.curr_mg.statistics.qc.bp_profile.percents.data) {
		    //content.removeChild(tag);
		    content.removeChild(div);
                    break;
		}
		data = widget.bp_areagraph(index);
		div.style.display = 'block';
		div.style.clear = 'both';
		data.target = div;
		Retina.Renderer.create("graph", data).render();
		break;
            case 'plot':
		data = widget.mg_plot(index, outputs[out].category);
		if (! data) {
                    //content.removeChild(tag);
	            content.removeChild(div);
                    break;
		}
		div.style.display = 'block';
		div.style.clear = 'both';
		data.target = div;
		Retina.Renderer.create("plot", data).render();
		break;
            case 'metadata_table':
		data = widget.metadata_table(index);
		div.style.display = 'block';
		div.style.clear = 'both';
		data.target = div;
		Retina.Renderer.create("table", data).render();
		break;
	    default:
	        break;
	    }
	}
    };
    
    // mg selector modal, use API selectlist
    widget.metagenome_modal = function(index, target) {
        jQuery('#mg_modal').modal('show');
        if (! Retina.WidgetInstances.metagenome_overview[index].mg_select_list) {
            Retina.WidgetInstances.metagenome_overview[index].mg_select_list = Retina.Widget.create('mgbrowse', {
                target: document.getElementById('mg_modal_body'),
                type: 'listselect',
                wide: true,
                multiple: false,
                callback: function (data) {
		    var widget = Retina.WidgetInstances.metagenome_overview[index];
                    if ((! data) || (data.length == 0)) {
        	        alert("You have not selected a metagenome");
            	        return;
        	    }
		    jQuery('#mg_modal').modal('hide');
		    widget.id = data['id'];
    		    widget.display();
                }
            });
        } else {
            Retina.WidgetInstances.metagenome_overview[index].mg_select_list.display();
        }
    };
    
    widget.general_overview = function (index) {
        var mg = Retina.WidgetInstances.metagenome_overview[index].curr_mg;
	// general overview
	var ncbi_id = mg.metadata.project.data.ncbi_id ? "<a href='http://www.ncbi.nlm.nih.gov/genomeprj/"+ncbi_id+"'>"+ncbi_id+"</a>" : "-";
	var gold_id = mg.metadata.library.data.gold_id ? "<a href='http://www.ncbi.nlm.nih.gov/genomeprj/"+gold_id+"'>"+gold_id+"</a>" : "-";
	var pubmed_id = "-";
	if (mg.metadata.library.data.pubmed_id) {
	    pubmed_id = mg.metadata.library.data.pubmed_id.split(", ");
	    var pm = [];
	    for (var i=0;i<pubmed_id.length;i++) {
		pm.push("<a href='http://www.ncbi.nlm.nih.gov/pubmed/"+pubmed_id[i]+"'>"+pubmed_id[i]+"</a>");
	    }
	    pubmed_id = pm.join(", ");
	}
	var pi_link = (mg.metadata.project.data.PI_email && mg.metadata.project.data.PI_firstname && mg.metadata.project.data.PI_lastname) ? "<a href='mailto:"+mg.metadata.project.data.PI_email+"'>"+mg.metadata.project.data.PI_firstname+" "+mg.metadata.project.data.PI_lastname+"</a>" : "-";
	var organization = mg.metadata.project.data.PI_organization || "-";
	var downloadLink = "<a href='?mgpage=download&metagenome="+mg.id+"'><img src='Retina/images/download.png' style='margin-left: 30px; width: 24px; position: relative; bottom: 5px;' title='download'></a><a href='?mgpage=analysis&metagenome="+mg.id+"' target=_blank><img src='Retina/images/notebook.png' style='margin-left: 30px; width: 24px; position: relative; bottom: 5px;' title='analysis'></a><a onclick='Retina.WidgetInstances.metagenome_overview[1].exportPDF("+index+");' style='cursor: pointer;'><img src='Retina/images/file-pdf.png' style='margin-left: 30px; width: 24px; position: relative; bottom: 5px;' title='download as PDF'></a>";
	var data = { data:
	             [ { title: "Metagenome Data Sheet for ID " + mg.id.substring(3) + downloadLink },
		       { table: [ [ { header: "Metagenome Name" }, mg.name, { header: "NCBI Project ID" }, ncbi_id ],
				  [ { header: "PI" }, pi_link, { header: "GOLD ID" }, gold_id ],
				  [ { header: "Organization" }, organization, { header: "PubMed ID" }, pubmed_id ],
				  [ { header: "Visibility" }, mg.status ]
				] }
		     ] };
	return data;
    };
    
    widget.metagenome_summary = function(index) {
        var mg = Retina.WidgetInstances.metagenome_overview[index].curr_mg;
	// hash the basic stats
	var stats  = mg.statistics.sequence_stats;
	var fuzzy  = Retina.WidgetInstances.metagenome_overview[index]._summary_fuzzy_math(mg);
	var is_rna = (mg.sequence_type == 'Amplicon') ? 1 : 0;
	var total  = parseInt(stats['sequence_count_raw']);
        var ptext  = " Of the remainder, "+fuzzy[3].formatString()+" sequences ("+widget._to_per(fuzzy[3], total)+") contain predicted proteins with known functions and "+fuzzy[2].formatString()+" sequences ("+widget._to_per(fuzzy[2], total)+") contain predicted proteins with unknown function.";
        var ftext  = " "+fuzzy[1].formatString()+" sequences ("+widget._to_per(fuzzy[1], total)+") have no rRNA genes"+(is_rna ? '.' : " or predicted proteins");
	var data = { data:
	             [ { header: "Metagenome Summary" },
		       { p: "The dataset "+mg.name+" was uploaded on "+mg.created+" and contains "+total.formatString()+" sequences totaling "+parseInt(stats['bp_count_raw']).formatString()+" basepairs with an average length of "+parseInt(stats['average_length_raw']).formatString()+" bps. The piechart below breaks down the uploaded sequences into "+(is_rna ? '3' : '5')+" distinct categories." },
		       { p: fuzzy[0].formatString()+" sequences ("+widget._to_per(fuzzy[0], total)+") failed to pass the QC pipeline. Of the sequences that passed QC, "+fuzzy[4].formatString()+" sequences ("+widget._to_per(fuzzy[4], total)+") contain ribosomal RNA genes."+(is_rna ? '' : ptext)+ftext },
		       { p: "The analysis results shown on this page are computed by MG-RAST. Please note that authors may upload data that they have published their own analysis for, in such cases comparison within the MG-RAST framework can not be done." }
		     ] };
	return data;
    };
    
    widget.toc_list = function(index) {
        return { width: "",
		 style: "margin-right: 20px; margin-left: 20px;",
		 data: [ { header: "Table of Contents" },
			 { fancy_table: { data: [
			     [ "<a href='#home'>Summary</a>" ],
			     [ "<a href='#project_information'>Project</a>" ],
			     [ "<a href='#analysis_statistics'>Statistics</a>" ],
			     [ "<a href='#mixs_metadata'>MIxS Metadata</a>" ],
			     [ "<a href='#drisee_introtext'>DRISEE</a>" ],
			     [ "<a href='#kmer_introtext'>K-mer Profile</a>" ],
			     [ "<a href='#bp_introtext'>Nucleotide Histogram</a>" ],
			     [ "<a href='#ontology_introtext'>Functional Hits</a>" ],
			     [ "<a href='#taxonomy_introtext'>Taxonomic Hits</a>" ],
			     [ "<a href='#rank_abund_introtext'>Rank Abundance Plot</a>" ],
			     [ "<a href='#rarefaction_introtext'>Rarefaction Curve</a>" ],
			     [ "<a href='#metadata_table'>Full Metadata</a>" ],
			     [ "<a href='?mgpage=download&metagenome="+Retina.WidgetInstances.metagenome_overview[index].curr_mg.id+"' target=_blank>Downloads</a>" ]
			 ] } }
		       ] };
    };

    widget.summary_piechart = function(index) {
        var mg = Retina.WidgetInstances.metagenome_overview[index].curr_mg;
	    var pieData = [];
	    var pieNums = Retina.WidgetInstances.metagenome_overview[index]._summary_fuzzy_math(mg);
	    var legend  = ["Failed QC", "Unknown", "Unknown Protein", "Annotated Protein", "ribosomal RNA"];
	    var colors  = ["#6C6C6C", "#dc3912", "#ff9900", "#109618", "#3366cc", "#990099"];
	    for (var i = 0; i < pieNums.length; i++) {
	        pieData.push({ name: legend[i], data: [ parseInt(pieNums[i]) ], fill: colors[i] });
	    }
	    var data = { 'title': 'Sequence Breakdown',
	                 'type': 'pie',
		         'title_settings': { 'font-size': '18px', 'font-weight': 'bold', 'x': 0, 'text-anchor': 'start' },
		         'x_labels': [ " " ],		     
		         'show_legend': true,
		         'legend_position': 'right',
			 'show_grid': false,
		         'width': 650,
		         'height': 300,
		         'data': pieData };
	    return data;
    };
    
    widget._summary_fuzzy_math = function(mg) {
        // get base numbers
        var stats  = mg.statistics.sequence_stats;
        var is_rna = (mg.sequence_type == 'Amplicon') ? 1 : 0;
        var raw_seqs    = ('sequence_count_raw' in stats) ? parseFloat(stats.sequence_count_raw) : 0;
        var qc_rna_seqs = ('sequence_count_preprocessed_rna' in stats) ? parseFloat(stats.sequence_count_preprocessed_rna) : 0;
        var qc_seqs     = ('sequence_count_preprocessed' in stats) ? parseFloat(stats.sequence_count_preprocessed) : 0;
        var rna_sims    = ('sequence_count_sims_rna' in stats) ? parseFloat(stats.sequence_count_sims_rna) : 0;
        var r_clusts    = ('cluster_count_processed_rna' in stats) ? parseFloat(stats.cluster_count_processed_rna) : 0;
        var r_clust_seq = ('clustered_sequence_count_processed_rna' in stats) ? parseFloat(stats.clustered_sequence_count_processed_rna) : 0;
        var ann_reads   = ('read_count_annotated' in stats) ? parseFloat(stats.read_count_annotated) : 0;
        var aa_reads    = ('read_count_processed_aa' in stats) ? parseFloat(stats.read_count_processed_aa) : 0;
        // first round math
        var qc_fail_seqs  = raw_seqs - qc_seqs;
        var ann_rna_reads = rna_sims ? (rna_sims - r_clusts) + r_clust_seq : 0;
        var ann_aa_reads  = (ann_reads && (ann_reads > ann_rna_reads)) ? ann_reads - ann_rna_reads : 0;
        var unkn_aa_reads = aa_reads - ann_aa_reads;
        var unknown_all   = raw_seqs - (qc_fail_seqs + unkn_aa_reads + ann_aa_reads + ann_rna_reads);
        if (raw_seqs < (qc_fail_seqs + ann_rna_reads)) {
            var diff = (qc_fail_seqs + ann_rna_reads) - raw_seqs;
            unknown_all = (diff > unknown_all) ? 0 : unknown_all - diff;
        }
        // fuzzy math
        if (is_rna) {
            qc_fail_seqs  = raw_seqs - qc_rna_seqs;
            unkn_aa_reads = 0;
            ann_aa_reads  = 0;
            unknown_all   = raw_seqs - (qc_fail_seqs + ann_rna_reads);
        } else {
            if (unknown_all < 0) { unknown_all = 0; }
            if (raw_seqs < (qc_fail_seqs + unknown_all + unkn_aa_reads + ann_aa_reads + ann_rna_reads)) {
      	        var diff = (qc_fail_seqs + unknown_all + unkn_aa_reads + ann_aa_reads + ann_rna_reads) - raw_seqs;
      	        unknown_all = (diff > unknown_all) ? 0 : unknown_all - diff;
            }
            if ((unknown_all == 0) && (raw_seqs < (qc_fail_seqs + unkn_aa_reads + ann_aa_reads + ann_rna_reads))) {
      	        var diff = (qc_fail_seqs + unkn_aa_reads + ann_aa_reads + ann_rna_reads) - raw_seqs;
      	        unkn_aa_reads = (diff > unkn_aa_reads) ? 0 : unkn_aa_reads - diff;
            }
            // hack to make MT numbers add up
            if ((unknown_all == 0) && (unkn_aa_reads == 0) && (raw_seqs < (qc_fail_seqs + ann_aa_reads + ann_rna_reads))) {
      	        var diff = (qc_fail_seqs + ann_aa_reads + ann_rna_reads) - raw_seqs;
      	        ann_rna_reads = (diff > ann_rna_reads) ? 0 : ann_rna_reads - diff;
            }
	    var diff = raw_seqs - (qc_fail_seqs + unkn_aa_reads + ann_aa_reads + ann_rna_reads);
	    if (unknown_all < diff) {
		unknown_all = diff;
	    }
        }
        return [ qc_fail_seqs, unknown_all, unkn_aa_reads, ann_aa_reads, ann_rna_reads ];
    };
    
    widget.piechart_footnote = function(index) {
	    return { width: "span9",
	             data: [ { footnote: { title: "Note:", text: "Sequences containing multiple predicted features are only counted in one category. Currently downloading of sequences via chart slices is not enabeled." } } ] };
    };
    
    widget.project_information = function(index) {
        var mg = Retina.WidgetInstances.metagenome_overview[index].curr_mg;
        try {
	        return { style: "clear: both",
	                 data: [ { header: "<a name='project_information' style='padding-top: 80px;'></a>Project Information" },
			         { p: "This metagenome is part of the project <a href='?mgpage=project&project="+mg.metadata.project.id+"' target=_blank>"+mg.metadata.project.name+"</a>" },
			         { p: mg.metadata.project.data.project_description }
			       ] };
		} catch (err) {
            return null;
	    }
    };
    
    widget.drisee_introtext = function(index) {
        var mg = Retina.WidgetInstances.metagenome_overview[index].curr_mg;
        var message = '';
        if (mg.sequence_type == 'Amplicon') {
            message = "DRISEE cannot be run on Amplicon datasets.";
        } else if (! mg.statistics.qc.drisee.percents.data) {
            message = "DRISEE could not produce a profile; the sample failed to meet the minimal ADR requirements to calculate an error profile (see Keegan et al. 2012)";
        } else {
            message = "DRISEE successfully calculated an error profile.";
        }
	return { style: "clear: both",
	         data: [ { header: "<a name='drisee_introtext' style='padding-top: 80px;'></a>DRISEE" },
			 { p: "Duplicate Read Inferred Sequencing Error Estimation (<a href='http://www.ploscompbiol.org/article/info%3Adoi%2F10.1371%2Fjournal.pcbi.1002541'>Keegan et al., PLoS Computational Biology, 2012</a>)" },
			 { p: message },
			 { p: "DRISEE is a tool that utilizes artificial duplicate reads (ADRs) to provide a platform independent assessment of sequencing error in metagenomic (or genomic) sequencing data. DRISEE is designed to consider shotgun data. Currently, it is not appropriate for amplicon data." },
			 { p: "Note that DRISEE is designed to examine sequencing error in raw whole genome shotgun sequence data. It assumes that adapter and/or barcode sequences have been removed, but that the sequence data have not been modified in any additional way. (e.g.) Assembly or merging, QC based triage or trimming will both reduce DRISEE's ability to provide an accurate assessment of error by removing error before it is analyzed." }
                       ] };
    };
    
    widget.kmer_introtext = function(index) {
        var mg = Retina.WidgetInstances.metagenome_overview[index].curr_mg;
        var retval = { style: "clear: both", data: [ { header: "<a name='kmer_introtext' style='padding-top: 80px;'></a>Kmer Profile" } ] };
	    retval.data.push( { p: "The kmer rank abundance graph plots the kmer coverage as a function of abundance rank, with the most abundant sequences at left." } );
	    return retval;
    };
    
    widget.bp_introtext = function(index) {
        var mg = Retina.WidgetInstances.metagenome_overview[index].curr_mg;
        var retval = { style: "clear: both", data: [ { header: "<a name='bp_introtext' style='padding-top: 80px;'></a>Nucleotide Histogram" } ] };
	    retval.data.push( { p: "These graphs show the fraction of base pairs of each type (A, C, G, T, or ambiguous base 'N') at each position starting from the beginning of each read up to the first 100 base pairs. Amplicon datasets should show consensus sequences; shotgun datasets should have roughly equal proportions of basecalls." } );
	    return retval;
    };
    
    widget.rank_abund_introtext = function(index) {
        return { style: "clear: both",
                 data: [ { header: "<a name='rank_abund_introtext' style='padding-top: 80px;'></a>Rank Abundance Plot" },
	                     { p: "The plot below shows the family abundances ordered from the most abundant to least abundant. Only the top 50 most abundant are shown. The y-axis plots the abundances of annotations in each family on a log scale." },
	                     { p: "The rank abundance curve is a tool for visually representing taxonomic richness and evenness." }
	                   ] };
    };
    
    widget.rarefaction_introtext = function(index) {
        return { data: [ { header: "<a name='rarefaction_introtext' style='padding-top: 80px;'></a>Rarefaction Curve" },
	                     { p: "The plot below shows the rarefaction curve of annotated species richness. This curve is a plot of the total number of distinct species annotations as a function of the number of sequences sampled. On the left, a steep slope indicates that a large fraction of the species diversity remains to be discovered. If the curve becomes flatter to the right, a reasonable number of individuals is sampled: more intensive sampling is likely to yield only few additional species." },
	                     { p: "Sampling curves generally rise very quickly at first and then level off towards an asymptote as fewer new species are found per unit of individuals collected. These rarefaction curves are calculated from the table of species abundance. The curves represent the average number of different species annotations for subsamples of the the complete dataset." }
	                   ] };
    };
    
    widget.ontology_introtext = function(index) {
	    return { style: "clear: both",
	             data: [ { header: "<a name='ontology_introtext' style='padding-top: 80px;'></a>Functional Category Hits Distribution" },
			             { p: "The pie charts below illustrate the distribution of functional categories for COGs, KOs, NOGs, and Subsystems at the highest level supported by these functional hierarchies. Each slice indicates the percentage of reads with predicted protein functions annotated to the category for the given source. " } ] };
    };
    
    widget.taxonomy_introtext = function(index) {
	    return { style: "clear: both",
	             data: [ { header: "<a name='taxonomy_introtext' style='padding-top: 80px;'></a>Taxonomic Hits Distribution" },
			             { p: "The pie charts below illustrate the distribution of taxonomic domains, phyla, and orders for the annotations. Each slice indicates the percentage of reads with predicted proteins and ribosomal RNA genes annotated to the indicated taxonomic level. This information is based on all the annotation source databases used by MG-RAST." } ] };
    };
    
    widget.annotation_piechart = function(index, dcat, dtype) {
        var annData = Retina.WidgetInstances.metagenome_overview[index].curr_mg.statistics[dcat][dtype];
        var pieData = [];
        var colors  = GooglePalette(annData.length);
        var annMax  = 0;
        var annSort = annData.sort(function(a,b) {
            return b[1] - a[1];
        });
        var skip = Math.max.apply(Math, annData.map(function(x){ return x[1]; })) / 20;

        for (var i = 0; i < annSort.length; i++) {
            var val = parseInt(annSort[i][1]);
            // skip if value too low to view
            if (val < skip) {
                continue;
            }
    	    pieData.push({ name: annSort[i][0], data: [ val ], fill: colors[i] });
    	    annMax = Math.max(annMax, annSort[i][0].length);
    	}
    	var pwidth  = 250;
    	var pheight = 250;
    	var lwidth  = Math.min(300, annMax*15);
    	var lheight = pieData.length * 18;
    	var width   = pwidth+lwidth;
    	var height  = (lheight > pheight) ? lheight : pheight;//Math.min(lheight, pheight+(pheight/2))
    	var data = { 'title': dtype,
    	             'type': 'pie',
    		     'title_settings': { 'font-size': '18px', 'font-weight': 'bold', 'x': 0, 'text-anchor': 'start' },
    		     'x_labels': [""],
    		     'show_legend': true,
    		     'legendArea': [pwidth+40, 20, lwidth, lheight],
    		     'chartArea': [25, 20, pwidth, pheight],
		     'show_grid': false,
    		     'width': width,
    		     'height': height,
    		     'data': pieData };
    	return data;
    };

    widget.taxon_linegraph = function(index, level, num) {
        var taxons = Retina.WidgetInstances.metagenome_overview[index].curr_mg.statistics.taxonomy;
        var lineData = [{ name: level+' rank abundance', data: []}];
        var xlabels  = [];
        var annSort  = taxons[level].sort(function(a,b) {
            return b[1] - a[1];
        });
        for (var i = 0; i < Math.min(num, annSort.length); i++) {
    	    lineData[0].data.push( parseInt(annSort[i][1]) );
    	    xlabels.push( annSort[i][0] );
    	}
        var gwidth  = 750;
    	var gheight = 300;
    	var longest = xlabels.reduce(function (a, b) { return a.length > b.length ? a : b; });
    	var data = { 'title': '',
    	             'type': 'column',
    	             'default_line_width': 2,
    	             'default_line_color': 'blue',
		             'y_scale': 'log',
    		         'x_labels': xlabels,
    		         'x_labels_rotation': '310',
    		         'x_tick_interval': xlabels.length,
    		         'show_legend': false,
    		         'chartArea': [80, 20, gwidth, gheight],
    		         'width': gwidth+80,
    		         'height': gheight+(longest.length * 4)+40,
    		         'data': lineData };
    	return data;
    };

    widget.bp_areagraph = function(index) {
        var mg = Retina.WidgetInstances.metagenome_overview[index].curr_mg;
        var labels = mg.statistics.qc.bp_profile.percents.columns;
        var bpdata = mg.statistics.qc.bp_profile.percents.data;
        var xt = 'bp '+labels[0];
        var yt = 'Percent bp';
        var names  = labels.slice(1);
        var colors = GooglePalette(names.length);
        var areaData = [];
        for (var x = 0; x < names.length; x++) {
    	    areaData.push({ name: names[x], data: [], fill: colors[x] });
    	}
        for (var i = 0; i < bpdata.length; i++) {
            for (var j = 1; j < bpdata[i].length; j++) {
                areaData[j-1].data.push( parseFloat(bpdata[i][j]) );
            }
        }
        var pwidth  = 750;
    	var pheight = 300;
    	var lwidth  = 15;
    	var lheight = areaData.length * 23;
    	var width   = pwidth+lwidth;
    	var height  = (lheight > pheight) ? Math.min(lheight, pheight+(pheight/2)) : pheight;
        var data = { 'x_title': xt,
                     'y_title': yt,
                     'type': 'stackedArea',
                     'x_tick_interval': parseInt(bpdata.length/50),
                     'x_labeled_tick_interval': parseInt(bpdata.length/10),
                     'show_legend': true,
                     'legendArea': [pwidth+20, 20, lwidth, lheight],
     		     'chartArea': [70, 20, pwidth, pheight],
     		     'width': width+40,
     		     'height': height+45,
                     'data': areaData
                 };
        return data;
    };

    widget.mg_plot = function(index, type, kmer) {
        var mg = Retina.WidgetInstances.metagenome_overview[index].curr_mg;
        var data, x, y, labels, points, xt, yt;
        var xscale = 'linear';
        var yscale = 'linear';
	    switch (type) {
	        case 'drisee':
	        try {
	            data = Retina.WidgetInstances.metagenome_overview[0].multi_plot(0, [1,2,3,4,5,6,7], mg.statistics.qc.drisee.percents.columns, mg.statistics.qc.drisee.percents.data, 'bp position', 'percent error');
	        } catch (err) {
        	    data = undefined;
        	}
            break;
            case 'kmer':
	        points = [];
	        var xi, yi;
            switch (kmer) {
                case 'ranked':
                xi = 3;
                yi = 5;
                xt = 'sequence size';
                yt = 'fraction of observed kmers';
                xscale = 'log';
                yscale = 'linear';
                break;
                case 'spectrum':
                xi = 0;
                yi = 1;
                xt = 'kmer coverage';
                yt = 'number of kmers';
                xscale = 'log';
                yscale = 'log';
                break;
                default:
                xi = 3;
                yi = 0;
                xt = 'sequence size';
                yt = 'kmer coverage';
                xscale = 'log';
                yscale = 'log';
                break;
            }
	        try {
	            for (var i = 0; i < mg.statistics.qc.kmer['15_mer']['data'].length; i+=2) {
	                var thisY = (yi == 5) ? 1 - parseFloat(mg.statistics.qc.kmer['15_mer']['data'][i][yi]) : mg.statistics.qc.kmer['15_mer']['data'][i][yi];
                    points.push([ mg.statistics.qc.kmer['15_mer']['data'][i][xi], thisY ]);
                }
                data = Retina.WidgetInstances.metagenome_overview[0].single_plot(points, xt, yt, xscale, yscale);
            } catch (err) {
        	    data = undefined;
        	}
            break;
            case 'rarefaction':
            try {
                data = Retina.WidgetInstances.metagenome_overview[0].single_plot(mg.statistics.rarefaction, 'number of reads', 'species count', xscale, yscale);
            } catch (err) {
            	data = undefined;
            }
            break;
            default:
            break;
        }
        return data;
    };

    widget.single_plot = function(nums, xt, yt, xscale, yscale) {
        if (! (nums && nums.length)) {
            return undefined;
        }
        var xy = [];
        var x_all = [];
        var y_all = [];
        for (var i = 0; i < nums.length; i++) {
            xy.push({ 'x': parseFloat(nums[i][0]), 'y': parseFloat(nums[i][1]) });
            x_all.push( parseFloat(nums[i][0]) );
            y_all.push( parseFloat(nums[i][1]) );
        }
        var pwidth  = 750;
    	var pheight = 300;
	    var ymax = Math.max.apply(Math, y_all);
	    ymax = ymax + (((yscale == 'log') ? 0.25 : 0.05) * ymax);
	    var pot = ymax.toString().indexOf('.') || ymax.toString.length;
	    pot = Math.pow(10, pot - 1);
	    ymax = Math.floor((ymax + pot) / pot) * pot;
        var data = { 'x_titleOffset': 40,
                     'y_titleOffset': 60,
		             'x_title': xt,
                     'y_title': yt,
                     'x_scale': xscale,
                     'y_scale': yscale,
                     'x_min': Math.min.apply(Math, x_all),
                     'x_max': Math.max.apply(Math, x_all),
                     'y_min': 0,
                     'y_max': ymax,
                     'show_legend': false,
                     'show_dots': false,
                     'connected': true,
                     'chartArea': [70, 20, pwidth, pheight],
                     'width': pwidth+40,
                     'height': pheight+45,
                     'data': {'series': [{'name': ''}], 'points': [xy]}          
                 };
        return data;
    };

    widget.multi_plot = function(x, y, labels, nums, xt, yt) {
        if (! (labels && nums && labels.length && nums.length)) {
            return undefined;
        }
        var series = [];
        var points = [];
        var x_all  = [];
        var y_all  = [];
        var annMax = 0;
        var colors = GooglePalette(y.length);
        for (var i = 0; i < y.length; i++) {
            series.push({'name': labels[y[i]], 'color': colors[i]});
            annMax = Math.max(annMax, labels[y[i]].length);
            xy = [];
            for (var j = 0; j < nums.length; j++) {
                xy.push({ 'x': parseFloat(nums[j][x]), 'y': parseFloat(nums[j][y[i]]) });
                x_all.push( parseFloat(nums[j][x]) );
                y_all.push( parseFloat(nums[j][y[i]]) );
            }
            points.push(xy);
        }
        var pwidth  = 750;
    	var pheight = 300;
    	var lwidth  = annMax * 10;
    	var lheight = series.length * 23;
    	var width   = pwidth+lwidth;
    	var height  = (lheight > pheight) ? Math.min(lheight, pheight+(pheight/2)) : pheight;
        var data = { 'y_titleOffset': 60,
                     'x_titleOffset': 40,
                     'x_title': xt,
                     'y_title': yt,
                     'x_min': Math.min.apply(Math, x_all),
                     'x_max': Math.max.apply(Math, x_all),
                     'y_min': Math.min.apply(Math, y_all),
                     'y_max': Math.max.apply(Math, y_all),
                     'show_legend': true,
                     'show_dots': false,
                     'connected': true,
                     'legendArea': [pwidth+20, 20, lwidth, lheight],
     		         'chartArea': [70, 20, pwidth, pheight],
     		         'width': width+40,
     		         'height': height+45,
                     'data': {'series': series, 'points': points}
                 };
        return data;
    };

    widget.metadata_table = function(index) {
        var md = Retina.WidgetInstances.metagenome_overview[index].curr_mg.metadata;
	
        var cats  = ['project', 'sample', 'library', 'env_package'];
        var tdata = [];
	if (md) {
            for (var c in cats) {
		if (md[cats[c]]) {
                    for (var key in md[cats[c]]['data']) {
			tdata.push([ cats[c], key, md[cats[c]]['data'][key] ]);
                    }
		}
            }
	}
        var data = { 'width': 400,
                     'height': 600,
                     'data': {'data': tdata, 'header': ['category', 'field', 'value']},
                     'rows_per_page': 20,
		     'minwidths': [100,1,1],
                     'sort_autodetect': true,
                     'filter_autodetect': true,
                     'hide_options': false
                   };
        return data;
    };

    widget.analysis_statistics = function(index) {
        var stats = Retina.WidgetInstances.metagenome_overview[index].curr_mg.statistics.sequence_stats;
	    return { width: "span6",
		     style: "float: left;",
		     data: [ { header: "<a name='analysis_statistics' style='padding-top: 80px;'></a>Analysis Statistics" },
			     { fancy_table: { data: [
			         [ { header: "Upload: bp Count" }, widget._to_num('bp_count_raw', stats)+" bp" ],
			         [ { header: "Upload: Sequences Count" }, widget._to_num('sequence_count_raw', stats) ],
			         [ { header: "Upload: Mean Sequence Length" }, widget._to_num('average_length_raw', stats)+" ± "+widget._to_num('standard_deviation_length_raw', stats)+" bp" ],
			         [ { header: "Upload: Mean GC percent" }, widget._to_num('average_gc_content_raw', stats)+" ± "+widget._to_num('standard_deviation_gc_content_raw', stats)+" %" ],
			         [ { header: "Artificial Duplicate Reads: Sequence Count" }, widget._to_num('sequence_count_dereplication_removed', stats) ],
			         [ { header: "Post QC: bp Count" }, widget._to_num('bp_count_preprocessed', stats)+" bp" ],
			         [ { header: "Post QC: Sequences Count" }, widget._to_num('sequence_count_preprocessed', stats) ],
			         [ { header: "Post QC: Mean Sequence Length" }, widget._to_num('average_length_preprocessed', stats)+" ± "+widget._to_num('standard_deviation_length_preprocessed', stats)+" bp" ],
			         [ { header: "Post QC: Mean GC percent" }, widget._to_num('average_gc_content_preprocessed', stats)+" ± "+widget._to_num('standard_deviation_gc_content_preprocessed', stats)+" %" ],
			         [ { header: "Processed: Predicted Protein Features" }, widget._to_num('sequence_count_processed_aa', stats) ],
			         [ { header: "Processed: Predicted rRNA Features" }, widget._to_num('sequence_count_processed_rna', stats) ],
			         [ { header: "Alignment: Identified Protein Features" }, widget._to_num('sequence_count_sims_aa', stats) ],
			         [ { header: "Alignment: Identified rRNA Features" }, widget._to_num('sequence_count_sims_rna', stats) ],
			         [ { header: "Annotation: Identified Functional Categories" }, widget._to_num('sequence_count_ontology', stats) ]
			     ] } }
			   ] };
    };
    
    widget.mixs_metadata = function(index, hide_link) {
        var md = Retina.WidgetInstances.metagenome_overview[index].curr_mg.mixs;
        var data = { width: "span5",
		     style: "float: right;",
		     data: [ { header: "<a name='mixs_metadata' style='padding-top: 80px;'></a>GSC MIxS Info" },
			     { fancy_table: { data: [
			         [ { header: "Investigation Type" }, md['sequence_type'] ],
			         [ { header: "Project Name" }, md['project'] ],
			         [ { header: "Latitude and Longitude" }, md['latitude']+" , "+md['longitude'] ],
			         [ { header: "Country and/or Sea, Location" }, md['country']+" , "+md['location'] ],
			         [ { header: "Collection Date" }, md['collection_date'] ],
			         [ { header: "Environment (Biome)" }, md['biome'] ],
			         [ { header: "Environment (Feature)" }, md['feature'] ],
			         [ { header: "Environment (Material)" }, md['material'] ],
			         [ { header: "Environmental Package" }, md['package'] ],
			         [ { header: "Sequencing Method" }, md['seq_method'] ]
			     ] }
			     }
			   ] };
	if (! hide_link) {
	    data.data[1].fancy_table.data.push( [{header: "More Metadata"}, "<a href='#metadata_table'>click for full table</a>"] );
	}
	return data;
    };
    
    widget._to_per = function(n, d) {
        return (parseInt(n) / parseInt(d) * 100).formatString(1) + "%";
    };
    
    widget._to_num = function(key, obj) {
        var num = (key in obj) ? obj[key] : 0;
        return parseInt(num).formatString();
    };

    // PDF Export
    widget.exportPDF = function () {
	var widget = Retina.WidgetInstances.metagenome_overview[1];

	if (! widget.curr_mg.metadata) {
	    alert('Metagenomes without metadata cannot be exported to PDF');
	    return;
	}

	// make sure there is only one instance of the pdf renderer
	if (Retina.RendererInstances.pdf.length > 1) {
	    Retina.RendererInstances.pdf.pop();
	}
	var pdf = Retina.Renderer.create('pdf', {}).render();

	// write the page header
	pdf.paragraph("Dataset "+widget.curr_mg.name+" (" + widget.id+") from the Study "+widget.curr_mg.metadata.project.name, "header");

	// subheader
	pdf.y -= 20;
	pdf.paragraph("a project by "+widget.curr_mg.metadata.project.data.PI_firstname+" "+widget.curr_mg.metadata.project.data.PI_lastname, "subheader");

	// metagenome summary
	pdf.paragraph("Summary", "heading");
	var d = widget.metagenome_summary(1).data;
	for (var i=1; i<d.length; i++) {
	    var font = "paragraph";
	    var k = Retina.keys(d[i])[0];
	    pdf.paragraph(d[i][k].replace(/<.+?>/ig, ""), font);
	}

	var imageFactor = 0.5;

	// sequence breakdown
	var img = document.getElementById('graph_div1').firstChild;
	img.setAttribute('id', 'sequenceBreakdown');
	pdf.svgImage('#sequenceBreakdown', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));

	// project information
	d = widget.project_information(1).data;
	for (var i=0; i<d.length; i++) {
	    var font = "paragraph";
	    var k = Retina.keys(d[i])[0];
	    if (k == "header") {
		font = "heading";
	    }
	    pdf.paragraph(d[i][k].replace(/<.+?>/ig, ""), font);
	}

	// DRISEE
	d = widget.drisee_introtext(1).data;
	for (var i=0; i<d.length; i++) {
	    var font = "paragraph";
	    var k = Retina.keys(d[i])[0];
	    if (k == "header") {
		font = "heading";
	    }
	    pdf.paragraph(d[i][k].replace(/<.+?>/ig, ""), font);
	}
	img = document.getElementById('plot_div0').firstChild;
	img.setAttribute('id', 'driseeGraph');
	pdf.svgImage('#driseeGraph', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));
	
	// Kmer
	d = widget.kmer_introtext(1).data;
	for (var i=0; i<d.length; i++) {
	    var font = "paragraph";
	    var k = Retina.keys(d[i])[0];
	    if (k == "header") {
		font = "heading";
	    }
	    pdf.paragraph(d[i][k].replace(/<.+?>/ig, ""), font);
	}
	img = document.getElementById('plot_div1').firstChild;
	img.setAttribute('id', 'kmerGraph');
	pdf.svgImage('#kmerGraph', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));

	// Nucleotide histogram
	d = widget.bp_introtext(1).data;
	for (var i=0; i<d.length; i++) {
	    var font = "paragraph";
	    var k = Retina.keys(d[i])[0];
	    if (k == "header") {
		font = "heading";
	    }
	    pdf.paragraph(d[i][k].replace(/<.+?>/ig, ""), font);
	}
	img = document.getElementById('graph_div2').firstChild;
	img.setAttribute('id', 'bpGraph');
	pdf.svgImage('#bpGraph', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));

	// Ontology
	d = widget.ontology_introtext(1).data;
	for (var i=0; i<d.length; i++) {
	    var font = "paragraph";
	    var k = Retina.keys(d[i])[0];
	    if (k == "header") {
		font = "heading";
	    }
	    pdf.paragraph(d[i][k].replace(/<.+?>/ig, ""), font);
	}
	img = document.getElementById('graph_div3').firstChild;
	img.setAttribute('id', 'ontologyGraph1');
	pdf.svgImage('#ontologyGraph1', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));
	img = document.getElementById('graph_div4').firstChild;
	img.setAttribute('id', 'ontologyGraph2');
	pdf.svgImage('#ontologyGraph2', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));
	img = document.getElementById('graph_div5').firstChild;
	img.setAttribute('id', 'ontologyGraph3');
	pdf.svgImage('#ontologyGraph3', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));
	img = document.getElementById('graph_div6').firstChild;
	img.setAttribute('id', 'ontologyGraph4');
	pdf.svgImage('#ontologyGraph4', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));

	// Taxonomy
	d = widget.taxonomy_introtext(1).data;
	for (var i=0; i<d.length; i++) {
	    var font = "paragraph";
	    var k = Retina.keys(d[i])[0];
	    if (k == "header") {
		font = "heading";
	    }
	    pdf.paragraph(d[i][k].replace(/<.+?>/ig, ""), font);
	}
	img = document.getElementById('graph_div7').firstChild;
	img.setAttribute('id', 'taxonomyGraph1');
	pdf.svgImage('#taxonomyGraph1', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));	
	img = document.getElementById('graph_div8').firstChild;
	img.setAttribute('id', 'taxonomyGraph2');
	pdf.svgImage('#taxonomyGraph2', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));	
	img = document.getElementById('graph_div9').firstChild
	img.setAttribute('id', 'taxonomyGraph3');
	pdf.svgImage('#taxonomyGraph3', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));	
	img = document.getElementById('graph_div10').firstChild;
	img.setAttribute('id', 'taxonomyGraph4');
	pdf.svgImage('#taxonomyGraph4', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));	
	img = document.getElementById('graph_div11').firstChild;
	img.setAttribute('id', 'taxonomyGraph5');
	pdf.svgImage('#taxonomyGraph5', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));	
	img = document.getElementById('graph_div12').firstChild;
	img.setAttribute('id', 'taxonomyGraph6');
	pdf.svgImage('#taxonomyGraph6', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));	

	// Rank Abundance
	d = widget.rank_abund_introtext(1).data;
	for (var i=0; i<d.length; i++) {
	    var font = "paragraph";
	    var k = Retina.keys(d[i])[0];
	    if (k == "header") {
		font = "heading";
	    }
	    pdf.paragraph(d[i][k].replace(/<.+?>/ig, ""), font);
	}
	img = document.getElementById('graph_div13').firstChild;
	img.setAttribute('id', 'rank_abundGraph');
	pdf.svgImage('#rank_abundGraph', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));

	// Rarefaction Plot
	d = widget.rarefaction_introtext(1).data;
	for (var i=0; i<d.length; i++) {
	    var font = "paragraph";
	    var k = Retina.keys(d[i])[0];
	    if (k == "header") {
		font = "heading";
	    }
	    pdf.paragraph(d[i][k].replace(/<.+?>/ig, ""), font);
	}
	img = document.getElementById('plot_div2').firstChild;
	img.setAttribute('id', 'rarefactionGraph');
	pdf.svgImage('#rarefactionGraph', parseInt(imageFactor * parseInt(img.getAttribute('width'))), parseInt(imageFactor * parseInt(img.getAttribute('height'))));
	
	// metadata table
	pdf.paragraph("Metadata", "heading");
	d = widget.metadata_table(1).data;
	var d2 = [];
	for (var i=0; i<d.data.length; i++) {
	    if (d.data[i][1] != "project_description" && d.data[i][1] != "project_name") {
		d2.push(d.data[i]);
	    }
	}
	pdf.y -= 30;
	pdf.table(d.header, d2);

	pdf.output(widget.curr_mg.name+".pdf");
    };

})();