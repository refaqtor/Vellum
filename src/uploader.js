define([
    'tpl!./templates/multimedia_modal',
    'tpl!./templates/multimedia_upload_trigger',
    'text!./templates/multimedia_queue.html',
    'text!./templates/multimedia_errors.html',
    'tpl!./templates/multimedia_existing_image',
    'tpl!./templates/multimedia_existing_audio',
    'tpl!./templates/multimedia_existing_video',
    'tpl!./templates/multimedia_nomedia',
    'text!./templates/multimedia_block.html',
    './util',
    'underscore',
    'file-uploader',
    'jquery',
    './core'
], function (
    multimedia_modal,
    multimedia_upload_trigger,
    multimedia_queue,
    multimedia_errors,
    multimedia_existing_image,
    multimedia_existing_audio,
    multimedia_existing_video,
    multimedia_nomedia,
    multimedia_block,
    util,
    _,
    HQMediaFileUploadController,
    $
) {
    "use strict";

    var SUPPORTED_EXTENSIONS = {
        image: [
            {
                'description': 'Images',
                'extensions': '*.jpg;*.png;*.gif'
            }
        ],
        audio: [
            {
                'description': 'Audio',
                'extensions': '*.mp3;*.wav'
            }
        ],
        video: [
            {
                'description': 'Video',
                'extensions': '*.3gp'
            }
        ]
    },
        PREVIEW_TEMPLATES = {
        image: multimedia_existing_image,
        audio: multimedia_existing_audio,
        video: multimedia_existing_video
    },
        SLUG_TO_CLASS = {
        image: 'CommCareImage',
        audio: 'CommCareAudio',
        video: 'CommCareVideo'
    },
        SLUG_TO_UPLOADER_SLUG = {
        image: 'fd_hqimage',
        audio: 'fd_hqaudio',
        video: 'fd_hqvideo'
    };

    
    function initUploadController(options) {
        var $uploaderModal = $(multimedia_modal({
            mediaType: options.mediaType,
            modalId: options.uploaderSlug
        }));
        $('#fd-multimedia-modal-container').append($uploaderModal);
        var uploadController = new HQMediaFileUploadController(
            options.uploaderSlug, 
            options.mediaType, 
            {
                fileFilters: SUPPORTED_EXTENSIONS[options.mediaType],
                uploadURL: options.uploadUrl,
                swfURL: options.swfUrl,
                isMultiFileUpload: false,
                queueTemplate: multimedia_queue,
                errorsTemplate: multimedia_errors,
                existingFileTemplate: PREVIEW_TEMPLATES[options.mediaType],
                licensingParams: ['shared', 'license', 'author', 'attribution-notes'],
                uploadParams: {},
                sessionid: options.sessionid
            }
        );
        uploadController.init();
        return uploadController;
    }

    // These functions were extracted out when separating the uploader code from
    // the JavaRosa Itext media widget code.  They could easily be made part of
    // the plugin interface in order to avoid passing around objectMap and
    // uploadControls, but it seems fine either way.
    var multimediaReference = function (mediaType, objectMap, uploadControls) {
        var ref = {};
        ref.mediaType = mediaType;

        ref.updateRef = function (path) {
            ref.path = path;
            ref.linkedObj = objectMap[path];
        };

        ref.isMediaMatched = function () {
            return _.isObject(ref.linkedObj);
        };

        ref.updateController = function () {
            var uploadController = uploadControls[ref.mediaType];
            uploadController.resetUploader();
            uploadController.currentReference = ref;
            uploadController.uploadParams = {
                path: ref.path,
                media_type : SLUG_TO_CLASS[ref.mediaType],
                old_ref: (ref.isMediaMatched()) ? ref.linkedObj.m_id : "",
                replace_attachment: true
            };
            uploadController.updateUploadFormUI();
        };

        return ref;
    };

    var addUploaderToWidget = function (widget, objectMap, uploadControls) {
        widget.mediaRef = multimediaReference(
            widget.form, objectMap, uploadControls);
    
        var $input = widget.getControl(),
            $uiElem = $('<div />'),
            _getParentUIElement = widget.getUIElement,
            $previewContainer = $('<div />')
                .addClass('fd-mm-preview-container'),
            ICONS = widget.mug.form.vellum.data.javaRosa.ICONS;

        widget.getUIElement = function () {
            var previewID = widget.id + '-preview-block',
                uploadID = widget.id + '-upload-block';
            $uiElem = _getParentUIElement();
            var $controlBlock = $uiElem.find('.controls'),
                $previewContainer = $('<div />')
                    .attr('id', previewID)
                    .addClass('fd-mm-preview-container'),
                $uploadContainer = $('<div />')
                    .attr('id', uploadID)
                    .addClass('fd-mm-upload-container');
            $controlBlock.empty()
                .addClass('control-row').data('form', widget.form);

            widget.updateReference();

            $previewContainer.html(getPreviewUI(widget, objectMap, ICONS));
            $controlBlock.append($previewContainer);

            $uploadContainer.html(multimedia_block);
            $uploadContainer.find('.fd-mm-upload-trigger')
                .append(getUploadButtonUI(widget, objectMap));
            $uploadContainer.find('.fd-mm-path-input')
                .append($input);

            $uploadContainer.find('.fd-mm-path-show').click(function (e) {
                var $showBtn = $(this);
                $showBtn.addClass('hide');
                $('#' + uploadID).find('.fd-mm-path').removeClass('hide');
                e.preventDefault();
            });

            $uploadContainer.find('.fd-mm-path-hide').click(function (e) {
                var $hideBtn = $(this);
                $hideBtn.parent().addClass('hide');
                $('#' + uploadID).find('.fd-mm-path-show').removeClass('hide');
                e.preventDefault();
            });
            $input.bind("change keyup", function () {
                updateMultimediaBlockUI(widget, $uiElem, objectMap);
            });
            $uiElem.on('mediaUploadComplete', function (event, data) {
                handleUploadComplete(widget, event, data, $uiElem, objectMap);
            });

            $controlBlock.append($uploadContainer);

            // reapply bindings because we removed the input from the UI
            $input.bind("change keyup", widget.updateValue);

            return $uiElem;
        };
        
        widget.handleUploadComplete = function (event, data, objectMap) {
            if (data.ref && data.ref.path) {
                objectMap[data.ref.path] = data.ref;
            }
            widget.updateMultimediaBlockUI($uiElem, objectMap);
        };
        
        widget.updateMultimediaBlockUI = function (objectMap) {
            $previewContainer.html(getPreviewUI(widget, objectMap, ICONS))
                .find('.existing-media').tooltip();

            $uiElem.find('.fd-mm-upload-trigger')
                .empty()
                .append(getUploadButtonUI(widget, objectMap));

            widget.updateReference();
        };

        widget.updateReference = function () {
            var currentPath = widget.getValue();
            $uiElem.attr('data-hqmediapath', currentPath);
            widget.mediaRef.updateRef(currentPath);
        };
    };

    var getPreviewUI = function (widget, objectMap, ICONS) {
        var currentPath = widget.getValue(),
            $preview;
        if (!currentPath && !widget.isDefaultLang) {
            currentPath = widget.getItextItem().getValue(widget.form, widget.defaultLang);
        }
        if (currentPath in objectMap) {
            var linkedObject = objectMap[currentPath];
            $preview = PREVIEW_TEMPLATES[widget.form]({
                url: linkedObject.url
            });
        } else {
            $preview = multimedia_nomedia({
                iconClass: ICONS[widget.form]
            });
        }
        return $preview;
    };

    var getUploadButtonUI = function (widget, objectMap) {
        var currentPath = widget.getValue(),
            $uploadBtn;
        $uploadBtn = $(multimedia_upload_trigger({
            multimediaExists: currentPath in objectMap,
            uploaderId: SLUG_TO_UPLOADER_SLUG[widget.form],
            mediaType: widget.form
        }));
        $uploadBtn.click(function () {
            widget.mediaRef.updateController();
        });
        return $uploadBtn;
    };
    
    var handleUploadComplete = function (widget, event, data, $uiElem, objectMap) {
        if (data.ref && data.ref.path) {
            objectMap[data.ref.path] = data.ref;
        }
        updateMultimediaBlockUI(widget, $uiElem, objectMap);
    };
    
    var updateMultimediaBlockUI = function (widget, $uiElem, objectMap) {
        $('#' + getPreviewID(widget)).html(getPreviewUI(widget, objectMap))
            .find('.existing-media').tooltip();

        $uiElem.find('.fd-mm-upload-trigger')
            .empty()
            .append(getUploadButtonUI(widget, objectMap));

        widget.updateReference();
    };
    
    return $.vellum.plugin("uploader", {
        objectMap: false,
        swfUrl: "lib/MediaUploader/flashuploader.swf",
        sessionid: false,
        uploadUrls: {
            image: false,
            audio: false,
            video: false
        },
    }, {
        init: function () {
            var opts = this.opts().uploader,
                uploadUrls = opts.uploadUrls,
                uploadEnabled = opts.objectMap && opts.swfUrl && opts.uploadUrls,
                sessionid = opts.sessionid,
                swfUrl = opts.swfUrl;

            this.data.uploader.uploadEnabled = uploadEnabled;
            this.data.uploader.objectMap = opts.objectMap;
            if (!uploadEnabled) {
                return;
            }

            this.data.uploader.uploadControls = {
                'image': initUploadController({
                    uploaderSlug: 'fd_hqimage', 
                    mediaType: 'image',
                    sessionid: sessionid,
                    uploadUrl: uploadUrls.image,
                    swfUrl: swfUrl
                }),
                'audio': initUploadController({
                    uploaderSlug: 'fd_hqaudio',
                    mediaType: 'audio',
                    sessionid: sessionid,
                    uploadUrl: uploadUrls.audio,
                    swfUrl: swfUrl
                }),
                'video': initUploadController({
                    uploaderSlug: 'fd_hqvideo',
                    mediaType: 'video',
                    sessionid: sessionid,
                    uploadUrl: uploadUrls.video,
                    swfUrl: swfUrl
                })
            };
        },
        initWidget: function (widget) {
            this.__callOld();
            if (!this.data.uploader.uploadEnabled) {
                return;
            }

            addUploaderToWidget(widget, 
                                this.data.uploader.objectMap, 
                                this.data.uploader.uploadControls);
        },
        initUploadController: function (options) {
            var $uploaderModal = $(multimedia_modal({
                mediaType: options.mediaType,
                modalId: options.uploaderSlug
            }));
            this.$f.find('.fd-multimedia-modal-container').append($uploaderModal);
            var uploadController = new HQMediaFileUploadController(
                options.uploaderSlug, 
                options.mediaType, 
                {
                    fileFilters: SUPPORTED_EXTENSIONS[options.mediaType],
                    uploadURL: options.uploadUrl,
                    swfURL: options.swfUrl,
                    isMultiFileUpload: false,
                    queueTemplate: multimedia_queue,
                    errorsTemplate: multimedia_errors,
                    existingFileTemplate: PREVIEW_TEMPLATES[options.mediaType],
                    licensingParams: ['shared', 'license', 'author', 'attribution-notes'],
                    uploadParams: {},
                    sessionid: options.sessionid
                }
            );
            uploadController.init();
            return uploadController;
        }
    });
});