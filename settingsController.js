'use strict';

app.controller('SettingsController', function ($scope, $log, $interval, $location, $timeout, appMgrRESTService, uiHelperService, deviceHelperService, sessionService, $http) {

    $scope.cafMetadata = {};
    $scope.cafMetadata.logLevel = 0;
    $scope.appMgrMetadata = {};
    $scope.appMgrMetadata.apiVersion  = 'unknown';
    $scope.appMgrMetadata.releaseVersion  = 'unknown';
    $scope.appMgrMetadata.builtOn  = 'unknown';
    
    $scope.fogportal = {};
    $scope.fogportal.hostname = "unknown";
    $scope.fogportal.port = 443;
    $scope.fogportal.pollingFrequencyInMinutes = 1;
    $scope.fogportal.pollingFrequencyInSecs = 60;
    $scope.fogportal.accessKeyId = "";
    $scope.fogportal.secretKey = "";
    $scope.fogportal.secretKeyExists = false;
    $scope.fogportal.lastAccessedTime = "unknown";
    $scope.fogportal.lastSuccessfulAccessTime = "unknown";
    $scope.fogportal.failureReason = "";
    $scope.fogportal.updateSecretKey = false;
    
    $scope.fogportalStatus = {};

    $scope.login = {};

    $scope.nodeWhiteColor = "rgba(255, 255, 255, 1.0)";
    $scope.nodeColor = "rgba(0, 0, 200, 0.5)";
    $scope.nodeHighlightColor = "rgba(0, 0, 200, 0.9)";

    $scope.nodeTotal = 1200000;
    $scope.nodeCols = 40;
    $scope.nodeRows = Math.ceil($scope.nodeTotal / $scope.nodeCols);
    $scope.nodeStepX = 10;
    $scope.nodeStepY = 10;
    $scope.nodeHeight = 5;
    $scope.nodeWidth = 5;
    $scope.focusNode = null;

    $scope.windowStartRow = 0;
    $scope.windowSizeRows = 50;

    $scope.bufferStartY = 0;
    $scope.bufferStartRow = 0;
    $scope.bufferSizeRows = 300;
    $scope.bufferEndY = $scope.bufferStartY + $scope.bufferSizeRows * $scope.nodeStepY;
    $scope.bufferUpdateY = $scope.bufferStartY + ($scope.bufferSizeRows - $scope.windowSizeRows) * $scope.nodeStepY;

    //$scope.canvasPosY = 0;
    //$scope.canvasSizeRows = 100;
    //$scope.canvasWidth = 500;
    //$scope.canvasHeight = 1000;

    //promise object to check the techsupport job status
    var techsupportJobStatusPromise;
    var techsupportDeletePromise;

    $scope.fogPortalSyncStatusPromise;
	    
    $log.info("Logging configuration controller invoked......");

    function init() {
        appMgrRESTService.operationalLogManagement.get(

            /** Success handler */
                function(obj){
                $log.info("Operation Log Management Query obj", obj);
                if(obj){
                    //Get the 'all' component log level details from
                    //rest response and set it into the scopr
                    $scope.allComponent = obj["all"];
                    if ($scope.allComponent.level === 'enable'){
                        $scope.cafMetadata.logLevel = 0;
                    }
                    else {
                        $scope.cafMetadata.logLevel = 1;
                    }
                }
            },

            /** Error handler */
                function (error) {
                $log.fatal("Operation Log Management Query failed", obj);
                $scope.allComponent = undefined;
            }

        ); //query ends....

        //Populate app mgr info

        appMgrRESTService.appMgrAboutRESTService.get(
            function(response){
                $scope.appMgrMetadata.apiVersion  = response.apiVersion;
                $scope.appMgrMetadata.releaseVersion  = response.releaseVersion;
                $scope.appMgrMetadata.builtOn  = response.builtOn;
            },
            function(error){
                $log.fatal("Could not retrieve app mgr about information");
            }
        );
        
        initFogPortalConfig();
        initNodes();
    }

    init();
    
    $scope.updateFogPortalConfig = function() {
    	var newFogPortalConfig = new appMgrRESTService.fogPortalRESTService();
        newFogPortalConfig.hostname = $scope.fogportal.hostname;
        newFogPortalConfig.httpsport = $scope.fogportal.port;
        newFogPortalConfig.metadataPollingFrequency = ($scope.fogportal.pollingFrequencyInMinutes * 60);
        newFogPortalConfig.accessKeyId = $scope.fogportal.accessKeyId;
        newFogPortalConfig.secretKey = $scope.fogportal.secretKey;
        
        newFogPortalConfig.$save(function(){
        	refreshFogPortalConfig();
        	uiHelperService.showNotification("Fog Portal Configuration Updated", "success");
    		if(!$scope.fogPortalSyncStatusPromise){
        		$scope.fogPortalSyncStatusPromise = $interval(refreshFogPortalStatus, 1000);
    		}
        }, function(){
        	uiHelperService.showNotification("Failed to update Fog Portal configuration", "error");
        });
    };

    $scope.syncFogPortalMetadataNow = function() {
        appMgrRESTService.fogPortalSyncMetadataRESTService.get(function(response){
            refreshFogPortalConfig();
            uiHelperService.showNotification("FogPortal Metadata Synced Now", "success");
    	    if(!$scope.fogPortalSyncStatusPromise){
        	$scope.fogPortalSyncStatusPromise = $interval(refreshFogPortalStatus, 1000);
    	    }
        },
        function(error){
            uiHelperService.showNotification("Failed to Sync FogPortal Metadata", "error");
        });
    };
    
    $scope.changeLogLevel = function(index){
        $log.info("Changing log level : isEnable ", index);
        appMgrRESTService.operationalLogManagement.update(
            {component : "all", level: (index === 0) ? "enable" : "disable"},
            
            //Update operation success call back
            function(obj){
                $log.info("Operation Log Management Update obj", obj);
                if(obj){
                    //Get the 'all' component log level details from 
                    //rest response and set it into the scopr
                    $scope.allComponent = obj["all"];
                }
            }, 
            
            //Update operation error call back
            function(error){
                $log.fatal("Operation Log Management Update failed", obj);
                $scope.allComponent = undefined;
            }
        );
    };
    
    function initFogPortalConfig()
    {
    	appMgrRESTService.fogPortalStatusRESTService.get(function(response){
    		$scope.fogportalStatus = response;
    		if (response.enabled)
			{
    			refreshFogPortalConfig();
    			refreshFogPortalStatus();
			}
    		else
			{
    			$log.info("Fog portal is disabled");
			}
    	}, function(error){
    		$log.info("Failed to fetch fogportal status");
    	});
    }

    $scope.updateEULAContent = function() {
        $http({
            method: 'GET',
            url: 'views/eula.html'
        }).then(function (response) {
            $scope.login.eulaContent = response.data;
            $scope.login.eulaWindow.center();
            $scope.login.eulaWindow.open()
        }, function errorCallback(response) {
            $scope.login.eulaContent = response;
        });
    }
    
    function refreshFogPortalConfig()
    {
    	appMgrRESTService.fogPortalRESTService.get(function(response){
            $scope.fogportal.hostname = response.hostname;
            $scope.fogportal.port = response.httpsport;
            $scope.fogportal.pollingFrequencyInSecs = response.metadataPollingFrequency;
            $scope.fogportal.pollingFrequencyInMinutes = Math.floor($scope.fogportal.pollingFrequencyInSecs / 60);
            $scope.fogportal.accessKeyId = response.accessKeyId;
            $scope.fogportal.secretKeyExists = response.secretKeyExists;
            $scope.fogportal.updateSecretKey = false;
        },
        function(error){
        	$log.fatal("Could not retrieve fog portal information");
        });
    }

    function refreshFogPortalStatus()
    {
        var lastAccessTime;
    	appMgrRESTService.fogPortalRESTService.get(function(response){
            if (response.whenLastReached)
        	{
                    lastAccessTime =  new Date().getTime() - response.whenLastReached + sessionService.getServerEpochBrowserEpochDifference();
		    if(lastAccessTime > 0){
	            	$scope.fogportal.lastSuccessfulAccessTime = deviceHelperService.convertMillisecondsToReadableString(lastAccessTime, false, true);
		    }
        	}
            else
        	{
            	$scope.fogportal.lastSuccessfulAccessTime = "never";
        	}
            if (response.whenLastAttempted)
        	{
                    lastAccessTime =  new Date().getTime() - response.whenLastAttempted + sessionService.getServerEpochBrowserEpochDifference();
		    if(lastAccessTime > 0){
	            	$scope.fogportal.lastAccessedTime = deviceHelperService.convertMillisecondsToReadableString(lastAccessTime, false, true);
                    }
        	}
            else
        	{
            	$scope.fogportal.lastAccessedTime = "never";
        	}
            $scope.fogportal.failureReason = response.reachabilityFailureCause;
        },
        function(error){
        	$log.fatal("Could not retrieve fog portal information");
        });
    }
    
    function downloadTechsupport(downloadUrl, fileName){
    	$log.info("Attempting to download the techsupport archive  ", downloadUrl);
    	window.open(downloadUrl, '_self');
    	
    	techsupportDeletePromise = $timeout(function() {
    		deleteTechsupportFile(fileName);
        }, 3000);
    };
    
    function deleteTechsupportFile(fileName){
    	if(techsupportDeletePromise){
    		$timeout.cancel(techsupportDeletePromise);
    	}
    	
    	$log.info("Deleting techsupport archive ", fileName);
    	appMgrRESTService.appmgrTechsupport.delete(
    		{"fileName" : fileName},
    		function(obj){
                $log.debug("Techsupport delete API call response", obj);
                kendo.ui.progress($("#settingsContainer"), false);
            }, 
            //Update operation error call back
            function(error){
                $log.fatal("Techsupport delete API call failed", obj);
                kendo.ui.progress($("#settingsContainer"), false);
            }
		);
    };
    
    function isTechsupportJobCompleted(jobId, downloadUrl, fileName){
    	$log.info("Checking the techsupport job status using ID : ", jobId, fileName);
    	appMgrRESTService.jobDetailRESTService.get(
    			{"jobId" : jobId},
    			function(obj){
                    $log.debug("Job status API get response", obj);
                    
                    if(obj.status === "COMPLETED" ){
     					$log.info("Job status changed to COMPLETED")
     					$interval.cancel(techsupportJobStatusPromise);
     					downloadTechsupport(downloadUrl, fileName);
     				}
                }, 
                //Update operation error call back
                function(error){
                    $log.fatal("Job status API get call failed", obj);
                    $interval.cancel(techsupportJobStatusPromise);
                    kendo.ui.progress($("#settingsContainer"), false);
                }
    	);
    };
    
    function onTechsupportCreateSuccess(obj){
    	$log.debug("Techsupport create API call response", obj);
        var fileName = obj.name;
        var downloadUrl = obj.download.href;
        var jobUrl = obj.job.href;
        
        $log.info("FileName: ", fileName, ", Download URI: ", downloadUrl, ", JOB URI: ", jobUrl);
        var jobURIarray = jobUrl.split("/");
        var JobId = jobURIarray[jobURIarray.length - 1];
    	$log.info("Techsupport create request JobID: ", JobId);
    	
    	techsupportJobStatusPromise = $interval(
    			function() {isTechsupportJobCompleted(JobId, downloadUrl, fileName)}, 
		500);
    };
    
    function onTechsupportCreateError(error){
    	kendo.ui.progress($("#settingsContainer"), false);
    	 $log.fatal("Techsupport create API call failed", obj);
    };
    
    $scope.generateAndDownloadTechsupportLogs = function(){
    	 kendo.ui.progress($("#settingsContainer"), true);
    	 
    	$log.info("Requesting to generate tech support logs");
    	 appMgrRESTService.appmgrTechsupport.save(
    			 onTechsupportCreateSuccess,
    			 onTechsupportCreateError
        );
    };
    
    $scope.$on('$destroy', function() {
    	if(techsupportJobStatusPromise){
    		$interval.cancel(techsupportJobStatusPromise);
    	}
    	
    	if(techsupportDeletePromise){
    		$timeout.cancel(techsupportDeletePromise);
    	}
    	
    	if($scope.fogPortalSyncStatusPromise){
    		$interval.cancel($scope.fogPortalSyncStatusPromise);
    	}
    });

    $scope.openExtensionsPage = function() {
        $location.path("/extensions");
    };

    function initNodes() {
        var dataviz = kendo.dataviz;
        var geom = kendo.geometry;
        var Point = geom.Point;
        var draw = kendo.drawing;
        var Path = draw.Path;
        var Text = draw.Text;
        var Group = draw.Group;
        var Rect = draw.Rect;
        var Circle = draw.Circle;
        var Arc = draw.Arc;

        var surface = null;

        function initSurface(type) {
            //var elem = $("#surface-container").find("surface").find("whiteboard");
            //return draw.Surface.create(elem, { type: type });
        }

        function createElements() {
            var container = new Group();

            for (var i = 0; i < 150; i++) {
                for (var j = 0; j < 40; j++) {
                    //var circle = new Circle(new geom.Circle([j * 10 + 10, i * 10 + 10], 3), {
                    var circle = new Path.fromRect(new geom.Rect([j * 10 + 10, i * 10 + 10], [5, 5]), {
                        fill: {
                            color: $scope.nodeColor
                        },
                        tooltip: {
                            content: "Hi, I am a circle",
                            position: "cursor",
                            offset: 10
                        }
                    });
                    container.append(circle);
                }
            }

            //container.append(path, group, circle, arc, rect);
            return container;
        }

        function getRowByY(y) {
            var raw = Math.floor((y - 10) / $scope.nodeStepY);
            return raw < 0 ? 0 : raw;
        }

        function getYByRow(row) {
            var y = row * $scope.nodeStepY + 10;
            return y;
        }

        function getNodeIndexByCoordinate(x, y) {
            var row = Math.floor((y - 10) / $scope.nodeStepY);
            var column = Math.floor(x / $scope.nodeStepX) - 1;
            var n = row * $scope.nodeCols + column;
            return n;
        }

        function getNodeCoordinateByIndex(n) {
            var i = Math.floor(n / $scope.nodeCols);
            var j = Math.floor(n % $scope.nodeCols);
            return [ j * $scope.nodeStepX + 10,
                     i * $scope.nodeStepY + 10 ];
        }

        function drawSingleNodeByIndex(n, isHighlighted) {
            var coord = getNodeCoordinateByIndex(n);
            var x = coord[0],
                y = coord[1] - $scope.bufferStartY;

            var canvas = document.getElementById('whiteboard');
            var ctx = canvas.getContext('2d');
            if (isHighlighted) {
                ctx.clearRect(x, y, $scope.nodeWidth, $scope.nodeHeight);

                ctx.fillStyle = $scope.nodeHighlightColor;
                ctx.fillRect(x, y, $scope.nodeWidth, $scope.nodeHeight);

            } else {
                //ctx.fillStyle = $scope.nodeWhiteColor;
                //ctx.fillRect(x, y, $scope.nodeWidth, $scope.nodeHeight);
                ctx.clearRect(x, y, $scope.nodeWidth, $scope.nodeHeight)

                ctx.fillStyle = $scope.nodeColor;
                ctx.fillRect(x, y, $scope.nodeWidth, $scope.nodeHeight);
            }
        }

        function drawNodes() {
            var canvas = document.getElementById('whiteboard');
            var ctx = null;

            if (canvas.getContext){
              var ctx = canvas.getContext('2d');
              // drawing code here
            } else {
              // canvas-unsupported code here
              console.log("Canvas not supported");
              return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            //ctx.fillStyle = $scope.nodeWhiteColor;
            //ctx.fillRect(0, 0, $scope.canvasWidth, $scope.canvasHeight);

            ctx.fillStyle = $scope.nodeColor;

            for (var i = 0; i < $scope.bufferSizeRows; i++) {
                for (var j = 0; j < $scope.nodeCols; j++) {
                    ctx.fillRect(
                        j * $scope.nodeStepX + 10,
                        i * $scope.nodeStepY + 10,
                        $scope.nodeWidth,
                        $scope.nodeHeight );
                }
            }
        }

        function updateBuffer(posY) {
            console.log("update buffer");

            var canvas = document.getElementById('whiteboard');
            var ctx = null;

            if (canvas.getContext){
                var ctx = canvas.getContext('2d');
                // drawing code here
            } else {
                // canvas-unsupported code here
                console.log("Canvas not supported");
                return;
            }

            var newMidRow = getRowByY(posY);
            var newStartRow = newMidRow - Math.floor($scope.bufferSizeRows / 2);
            var newEndRow = newMidRow + Math.floor($scope.bufferSizeRows / 2);

            var newStartY = getYByRow(newStartRow);
            var newEndY = getYByRow(newStartRow + $scope.bufferSizeRows);
            var newUpdateY = getYByRow(newStartRow + $scope.bufferSizeRows - $scope.windowSizeRows);

            canvas.style.position = "relative";
            //canvas.style.left = '0px';
            canvas.style.top = newStartY + 'px';

            //$('#whiteboard').css({marginTop: '+=' + newStartY + 'px'});

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            //ctx.fillStyle = $scope.nodeWhiteColor;
            //ctx.fillRect(0, 0, $scope.canvasWidth, $scope.canvasHeight);

            ctx.fillStyle = $scope.nodeColor;

            for (var i = 0; i < $scope.bufferSizeRows; i++) {
                for (var j = 0; j < $scope.nodeCols; j++) {
                    ctx.fillRect(
                        j * $scope.nodeStepX + 10,
                        i * $scope.nodeStepY + 10,
                        $scope.nodeWidth,
                        $scope.nodeHeight );
                }
            }

            $scope.bufferStartY = newStartY;
            $scope.bufferEndY = newEndY;
            $scope.bufferUpdateY = newUpdateY;
        }

        $(document).ready(function () {
            //$("#surface").css("height", (150 * 10 + 100) + "px");
            $("#surface").css("height", ($scope.nodeRows * $scope.nodeStepY + 100) + "px");

            var whiteboard = document.getElementById("whiteboard");

            whiteboard.width = $scope.nodeCols * $scope.nodeStepX + 2;
            whiteboard.height = $scope.bufferSizeRows * $scope.nodeStepY;

            //whiteboard.height = $scope.convasSizeRows * $scope.nodeStepY;
            //whiteboard.height = $scope.nodeRows * $scope.nodeStepY;

            drawNodes();

            //surface = initSurface("canvas");
//            var group = createElements();
//            surface.draw(group);

            /*$("#select-type li").each(function () {
                var type = $(this).text().toLowerCase();
                if (!kendo.support[type]) {
                    $(this).addClass("km-state-disabled");
                }
            });*/

            $("#select-type").kendoMobileButtonGroup({
                select: function (e) {
                    switch(e.index) {
                        case 0:
                            $scope.nodeColor = 'rgba(0, 0, 200, 0.5)';
                            $scope.nodeHighlightColor = 'rgba(0, 0, 200, 0.9)';
                            break;
                        case 1:
                            $scope.nodeColor = 'rgba(200, 0, 0, 0.5)';
                            $scope.nodeHighlightColor = 'rgba(200, 0, 0, 0.9)';
                            break;
                        case 2:
                            $scope.nodeColor = 'rgba(0, 200, 0, 0.5)';
                            $scope.nodeHighlightColor = 'rgba(0, 200, 0, 0.9)';
                            break;
                    }
                    
//                    var option = $("li", e.sender.element).eq(e.index);
//                    var type = option.text().toLowerCase();
//                    $scope.nodeColor = option.text();
                    
                    //surface.destroy();
                    //surface = initSurface("canvas");
                    //ar group = createElements();
                    //surface.draw(group);
                    drawNodes();
                },
                index: $("#select-type li:not(.km-state-disabled)").index()
            });

            $("#surface-container")
                .on("mousemove", function(e) {
                    var offset = $(this).offset();
                    var posX = e.pageX - offset.left;
                    var posY = e.pageY - offset.top;
                    var scrollTop = this.scrollTop;

                    var n = getNodeIndexByCoordinate(posX, posY+scrollTop)

                    if (n === $scope.focusNode) {
                        return;
                    }

                    console.log("posX=" + posX);
                    console.log("posY=" + posY);
                    console.log("n=" + n);

                    drawSingleNodeByIndex(n, true);
                    
                    if ($scope.focusNode != null) {
                        drawSingleNodeByIndex($scope.focusNode, false);
                    }
                    $scope.focusNode = n;

                    $("#node-tooltip").css({
                        left: e.pageX - 30,
                        top: e.pageY - 100,
                        visibility: "visible"
                    });
                    $("#node-name").text("Device " + $scope.focusNode);

                    //path.segments[0].anchor().move(e.pageX - offset.left, e.pageY - offset.top);

                    /*for (var i = 0; i < points - 1; i++) {
                        var point = path.segments[i].anchor();
                        var nextPoint = path.segments[i + 1].anchor();

                        var vector = point.clone().translate(-nextPoint.x, -nextPoint.y);
                        vector.scale(distance / vector.distanceTo(Point.ZERO));

                        nextPoint.move(point.x - vector.x, point.y - vector.y);
                    }*/
                })
                .on("mouseout", function(e) {
                    if ($scope.focusNode != null) {
                        drawSingleNodeByIndex($scope.focusNode, false);
                    }
                    $scope.focusNode = null;

                    $("#node-tooltip").css({
                        visibility: "hidden"
                    });
                })
                .on("mousedown", function(e) {
                    //path.options.stroke.set("width", 2);
                })
                .on("mouseup", function(e) {
                    //path.options.stroke.set("width", 20);
                })
                .scroll(function() {
                    if (this.scrollTop < $scope.bufferStartY || this.scrollTop > $scope.bufferUpdateY) {
                        updateBuffer(this.scrollTop);
                    }
                })
        });
    }
});
