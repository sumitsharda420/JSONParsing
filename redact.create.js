var documentViewer = null,
    urlVars = Utils.getUrlVars(window.location.href),
    roomId = urlVars["roomId"],
    folderId = urlVars["folderId"],
    docId = urlVars["docId"],
    redactions = new Array(),
    excelMode = true,
    showActivetab = false;
isRedactedCells = false;
lastFocusedId = "",
    versionNumber = urlVars["versionNumber"],
    isSheetChanged = false,
    isPageChanged = false,
    focusedRowIndex=0,
    helperRedStr = "<div class=\"div-redact-wrapper\" style=\"border: 2px solid black; z-index: 1000; border-radius: 5px; height: 30px; width: 50px; position: absolute; opacity: 0.5;\">" +
    "<div class=\"redact-resize\" style=\"display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; overflow: hidden;\">" +
    "<p class=\"red-fit\"></p></div>" +
    "<div class=\"ui-resizable-handle ui-resizable-se ui-icon ui-icon-grip-diagonal-se\" style=\"z-index: 90; display: block; cursor: se-resize!important;background-color: lightblue;\"></div>" +
    "<div class=\"ui-resizable-handle ui-resizable-sw ui-icon ui-icon-gripsmall-diagonal-se\" style=\"z-index: 90; display: none; cursor: ne-resize; transform: rotate(90deg); left: 1px; bottom: 1px;\"></div>" +
    "</div>";

window.onbeforeunload = null;

$(function () {
    roomId = urlVars["roomId"];
    folderId = urlVars["folderId"];
    docId = urlVars["docId"];

    $(".div-redact-cntl").draggable({
        scope: "redaction",
        containment: "window",
        revert: "invalid",
        helper: function (event) {
            var img = $(helperRedStr)
            return img;
        },
        drag: function (event, ui) {
        },
        cursorAt: { left: 5, top: 5 },
        iframeFix: true
    });
    LoadRedactionGrid();
});

// #region spreadsheet methods

function onSelectionChanged(s, e) {
    if (redactions.length > 0 && e.selection.activeCellRowIndex != undefined) {
        var currentsheetName = s.GetActiveSheetName();
        var index = redactions.findIndex(obj => obj.SheetName == currentsheetName);
        if (index >= 0) {
            var currentsheetIndex = index != -1 ? redactions[index].page : 0;
            var redact = redactions.findIndex(obj => obj.RowIndex == e.selection.activeCellRowIndex && obj.ColumnIndex == e.selection.activeCellColumnIndex && obj.page == currentsheetIndex);
            if (redact != -1) {
                var pageSize = redactionTable.cpPageSize;
                var CurrIndex = redactionTable.GetPageIndex();               
                var pagenum = Math.ceil((redact+1) / pageSize)
                if (pagenum - 1 != CurrIndex) {
                    redactionTable.GotoPage(pagenum - 1);
                    focusedRowIndex = redact;
                }
                else {
                    redactionTable.MakeRowVisible(redact)
                    redactionTable.SetFocusedRowIndex(redact) 
                    OnRowClick(s, redact);
                }                         
                isSheetChanged = true;
               
                EnableDisableButtons();
            }
        }

    }
}
var spreadsheet_End = function (s, e) {
    if (!showActivetab) {
        redactionTable.PerformCallback({ roomId: roomId, folderId: folderId, docId: docId, isSpreadSheet: true });
    }
    EnableDisableButtons();
}
function onPopUpMenuShowing(spreadsheet, args) {
    args.cancel = true;
}
var onToogle_OnClick = function (s, e) {
    var spreadSheetModel = new Object();
    spreadSheetModel.roomId = roomId;
    spreadSheetModel.folderId = folderId;
    spreadSheetModel.docId = docId;
    spreadSheetModel.versionNumber = 1;
    spreadSheetModel.signalRConnectionId = signalRConnectionId;
    spreadSheetModel.isApplyAndSave = false;
    spreadSheetModel.ChangeFilePath = false;
    spreadSheetModel.toogleSheet = true;
    spreadSheetModel.showOriginalContent = excelMode;
    spreadSheetModel.IsSelectedCells = $("input[name='chkOnlySelectedcells']").val() === "C";
    Spreadsheet.PerformCallback({ spreadSheetModel: spreadSheetModel });
    if (excelMode) {
        excelMode = false;
        s.SetText("See Redacted Content");
    }
    else {
        s.SetText("See Original Content");
        excelMode = true;
    }

}
function OnCustomCommandExecuted(s, e) {
    var spreadSheetModel = new Object();
    spreadSheetModel.roomId = roomId;
    spreadSheetModel.folderId = folderId;
    spreadSheetModel.docId = docId;
    spreadSheetModel.versionNumber = 1;
    spreadSheetModel.signalRConnectionId = signalRConnectionId;
    spreadSheetModel.isApplyAndSave = false;
    spreadSheetModel.ChangeFilePath = false;
    spreadSheetModel.redactLinkedCells = $("input[name='chkRedactLinkedCells']").val() === "C";
    Spreadsheet.PerformCallback({ spreadSheetModel: spreadSheetModel });
    isRedactedCells = true;
    showActivetab = false;
}
var onApplyAndSaveRedExcel_OnClick = function (s, e) {
    OnCustomCommandExecuted(s, e);
};
var onSaveRedactionExcel_OnClick = function (s, e) {
    OnCustomCommandExecuted(s, e);
};

// #endregion

// #region document Events
var documentViewerLoaded = function (sender, e) {

    documentViewer = sender;

    var
        viewerFrame = $(documentViewer.iframe.contentWindow.document),
        viewerFrameHead = viewerFrame.find("head"),
        style_rules = [];

    style_rules.push(".red-fit { display: inline-block!important; white-space: nowrap!important; } ");
    style_rules.push(".active-red-elem { /*border: 2px dashed black!important;*/ background-color: indianred!important; } ");
    style_rules.push(".active-self-sign-elem .div-sign-back{ /*border: 2px dashed black!important;*/ /*background-color: lightskyblue!important;*/ background-color: indianred !important; } ");
    style_rules.push(".self-sign-main { display: none; } ");
    var style = "<style type=\"text/css\">" + style_rules.join("\n") + "</style>";
    viewerFrameHead.append(style);

};
var documentViewerFailed = function (sender, e) {
    console.log(e);
};
var documentViewerDocumentLoaded = function (sender, e) {
    var viewerElem = $(documentViewer.instance.docViewer.pM);

    viewerElem.off();
    viewerElem.parent().off();
    documentViewer.instance.setLayoutMode('Continuous');
    var vf = $(documentViewer.element),
        vfo = vf.offset();

    var pcs = viewerElem.find(".pageSection");

    if (redactions.length > 0) {

        pcs.each(function (index, elem) {

            var el = $(elem),
                preds = $.grep(redactions, function (item) { return item.page === (index + 1); });

            $(preds).each(function (ind, element) {

                var it = element,
                    copy = $(helperRedStr);
                var redact = redactions.findIndex(obj => obj.clientRedactionId == element.clientRedactionId);
                if (redact != -1) {
                    redactions[redact].Red = copy;
                    redactions[redact].isTouched = false;
                }

                copy.data("clientRedactionId", it.clientRedactionId);

                initRedactionEvents(copy, viewerElem);
                initRedactionDraggable(copy, viewerElem, vfo);
                initRedactionResizable(copy, el, vf);
                initRedactionFitty(copy, it.Text);
                let redactionColor = "green";
                if (element.Approved == true) {
                    redactionColor = "lightgray";
                }

                if (element.isDeleted == true && element.Approved == false) {
                    redactionColor = "red";
                }
                el.append(copy.css({
                    top: it.top + "%",
                    left: it.left + "%",
                    width: it.width + "%",
                    height: it.height + "%",
                    "background-color": redactionColor
                }).addClass("moved"));

            });
        });

        EnableDisableButtons();
    }
    pcs.droppable({
        scope: "redaction",
        tolerance: "fit",
        drop: function (e, ui) {
            var redaction = new Object();
            var psd = $(this),
                psdw = psd.width(),
                psdh = psd.height(),
                posew = null,
                poseh = null;

            var newPosX = ui.offset.left - (psd.offset().left + vfo.left);
            var newPosY = ui.offset.top - (psd.offset().top + vfo.top);

            var copy = ui.helper.hasClass("moved") ? ui.helper : ui.helper.clone(true),
                redCopy = ui.helper.hasClass("div-redact-wrapper");
            var redactionText = stickyRedactionLabel;

            if (redactions.length > 0) {
                var maxLastseen = redactions.sort((a, b) => Date.parse(b.TextModifiedDate) - Date.parse(a.TextModifiedDate))[0];
                redactionText = maxLastseen.Text;
            }
            else {
                redactionText = stickyRedactionLabel
            }
            if (copy.hasClass("moved")) {
                copy.data("isNew", false);
                newPosX = newPosX + vfo.left;
                newPosY = newPosY + vfo.top;
                posew = ((newPosX / psdw) * 100) + "%";
                poseh = ((newPosY / psdh) * 100) + "%";
                psd.append(copy.css({ top: poseh, left: posew }));
                var pn = pcs.index(psd) + 1;
                var rew = ((copy.width()) / psdw) * 100 + "%",
                    reh = ((copy.height()) / psdh) * 100 + "%";

                var redact = redactions.findIndex(obj => obj.clientRedactionId == copy.data("clientRedactionId"));
                if (redact != -1) {
                    redactions[redact].top = poseh.slice(0, -1);
                    redactions[redact].left = posew.slice(0, -1);
                    redactions[redact].width = rew.slice(0, -1);
                    redactions[redact].height = reh.slice(0, -1);
                    redactions[redact].Approved = false;
                    redactions[redact].isTouched = true;
                }


                if (redCopy) {
                    markRedNotSaved(copy);
                }

                return;
            }
            else {
                copy.data("isNew", true);
                copy.data("clientRedactionId", Utils.uuidv4());
            }

            initRedactionDraggable(copy, viewerElem, vfo);

            if (redCopy) {
                initRedactionEvents(copy, viewerElem);

                initRedactionResizable(copy, psd, vf);

                initRedactionFitty(copy, redactionText);
            }


            posew = ((newPosX / psdw) * 100) + "%";
            poseh = ((newPosY / psdh) * 100) + "%";

            var rew = ((copy.width()) / psdw) * 100 + "%",
                reh = ((copy.height()) / psdh) * 100 + "%";

            psd.append(copy.css({ top: poseh, left: posew, width: rew, height: reh }).addClass("moved"));
            if (!copy.data("isNew")) {
                var redact = redactions.findIndex(obj => obj.clientRedactionId == copy.data("clientRedactionId"));
                if (redact != -1) {
                    redactions[redact].top = poseh.slice(0, -1);
                    redactions[redact].left = posew.slice(0, -1);
                    redactions[redact].width = rew.slice(0, -1);
                    redactions[redact].height = reh.slice(0, -1);
                    redactions[redact].isTouched = true;
                }

            }
            else {
                redaction.top = poseh.slice(0, -1);
                redaction.Id = 0;
                redaction.left = posew.slice(0, -1);
                redaction.width = rew.slice(0, -1);
                redaction.height = reh.slice(0, -1);
                redaction.isNew = copy.data("isNew");
                redaction.deleted = false;
                redaction.isDeleted = false;
                redaction.Approved = false;
                redaction.isTouched = true;
                redaction.clientRedactionId = copy.data("clientRedactionId");
                redaction.Text = redactionText;
                redaction.page = pcs.index(psd) + 1;
                redaction.Red = copy;
                redactions.push(redaction);
            }
            if (redCopy) {
                markRedNotSaved(copy);
            }
        }

    });

};
var documentViewerPageChanged = function (sender, e) {
};
var documentViewerPageRendered = function (sender, e) {
    var viewerElem = $(documentViewer.instance.docViewer.pM);
    $(viewerElem.find(".pageSection")[e.pageNumber - 1]).find(".div-redact-wrapper").each(function (ind, elem) {
        $(elem).data("fittyEl").fit();
    });

};
// #endregion

// #region Draggable Events
var initRedactionFitty = function (copy, text) {
    var fitp = copy.find(".red-fit"),
        pfitp = fitp.parent(".redact-resize");

    fitp.text(text);

    var fittyEl = fitty(fitp[0], {
        minSize: 1,
        maxSize: 80
    });

    copy.data("fittyEl", fittyEl);

    fittyEl.element.addEventListener("fit", function (e) {
        // log the detail property to the console

        if (fitp.width() > pfitp.width()) {
            pfitp.css("justify-content", "flex-start");
        } else {
            pfitp.css("justify-content", "center");
        }

    });

};
var initRedactionEvents = function (copy, viewerElem) {
    copy.on("click", function (ev) {

        if (redactions.length > 0) {
            if (lastFocusedId != '' && !IsSpreadSheet) {
                ChangeRedactionColor(lastFocusedId);
            }
            var redact = redactions.findIndex(obj => obj.clientRedactionId == copy.data("clientRedactionId"));
            if (redact != -1) {
                var pageSize = redactionTable.cpPageSize;
                var CurrIndex = redactionTable.GetPageIndex();
                var pagenum = Math.ceil((redact + 1) / pageSize)
                if (pagenum - 1 != CurrIndex) {
                    redactionTable.GotoPage(pagenum - 1);
                    focusedRowIndex = redact;
                }
                else {
                    redactionTable.MakeRowVisible(redact)
                    redactionTable.SetFocusedRowIndex(redact)
                    
                }
                isSheetChanged = true;                
                lastFocusedId = copy.data("clientRedactionId");
                copy.css({ "background-color": "yellow" })
                EnableDisableButtons();
            }
        }
    });
    copy.on("mousedown", function (ev) {
        ev.stopPropagation();

        var cp = copy.offset(),
            vf = $(documentViewer.element),
            vfo = vf.offset();

        copy.draggable("option", "cursorAt", { left: ev.clientX - cp.left + vfo.left, top: ev.clientY - cp.top + vfo.top });


    });
};
var initRedactionDraggable = function (copy, viewerElem, vfo) {
    var revertOccurred = false,
        cpl = "",
        cpt = "";

    copy.draggable({
        scope: "redaction",
        helper: "original",
        cursorAt: false,
        containment: viewerElem,
        iframeFix: true,
        start: function (event, ui) {

            event.stopImmediatePropagation();
            cpl = copy[0].style.left;
            cpt = copy[0].style.top;

        },
        drag: function (event, ui) {

        },
        revert: function (ivd) {

            if (!ivd) {
                revertOccurred = true;
                return true;
            }

        },
        stop: function (event, ui) {
            if (revertOccurred) {
                copy[0].style.left = cpl;
                copy[0].style.top = cpt;
                cpl = "";
                cpt = "";
                revertOccurred = false;
            }
        }
    });

};
var initRedactionResizable = function (copy, psd, vf) {
    copy.resizableSafe({
        handleSelector: "> .ui-resizable-se",
        onDragStart: function (ev, $el, opt) {
            ev.stopImmediatePropagation();

        },
        onDragEnd: function (ev, $el, opt) {

            ev.stopImmediatePropagation();

            var rew = ($el.width() / psd.width()) * 100 + "%",
                reh = ($el.height() / psd.height()) * 100 + "%";

            $el.width(rew);
            $el.height(reh);
            copy.data("isNew", false);
            var redact = redactions.findIndex(obj => obj.clientRedactionId == copy.data("clientRedactionId"));
            if (redact != -1) {
                redactions[redact].width = rew.slice(0, -1);
                redactions[redact].height = reh.slice(0, -1);
                redactions[redact].Approved = false;
                redactions[redact].isTouched = true;
                copy.data("deleted", redactions[redact].isDeleted);
            }
            markRedNotSaved(copy);
        },
        onDrag: function (ev, $el, newWidth, newHeight, opt) {

            ev.stopImmediatePropagation();

            var vfo = vf.offset(),
                ep = $el.position(),
                psdw = psd.width(),
                psdh = psd.height();
            newWidth = newWidth - vfo.left;
            newHeight = newHeight - vfo.top;
            if (((ep.left + newWidth) > psdw - 4) || ((ep.top + newHeight) > psdh - 2)) {
                return false;
            }
            $el.width(newWidth);
            $el.height(newHeight);
            copy.data("fittyEl").fit();
            return false;
        },
        touchActionNone: false,
    });
};
// #endregion

// #region Gridview Events
var OnGridViewSelectionChanged = function (s, e) {
    UpdateTitlePanel();
}
function OnGridViewInit() {
    UpdateTitlePanel();
}
function onSelectAllClick() {
    redactionTable.SelectRows();
}
function onClearSelectionClick() {
    redactionTable.UnselectRows();
}
function UpdateTitlePanel() {
    EnableDisableButtons();
}
// #endregion

// #region Crud Events
var onDeleteAllRedactions_OnClick = function (s, e) {
    DeleteRedactionsConfirmationPopup.Hide();
    if (IsSpreadSheet) {
        showActivetab = false;
    }
    if (redactionTable.GetSelectedKeysOnPage().length > 0) {
        redactionTable.GetSelectedFieldValues("clientRedactionId", function (values) {
            for (var i = 0; i < values.length; i++) {

                redactions.filter(someobject => someobject.clientRedactionId == values[i])
                    .forEach(someobject => {
                        someobject.deleted = true;
                        someobject.isDeleted = true;
                        someobject.isTouched = true;
                        if (!IsSpreadSheet) {
                            someobject.Red.css({ "background-color": "red" });
                        }
                    });
            }
            saveRedactions(false, null, values.length === redactions.length);
        })

    }
    else {
        var redaction = redactions.findIndex(obj => obj.clientRedactionId === lastFocusedId);
        if (redaction != -1) {
            redactions[redaction].deleted = true;
            redactions[redaction].isDeleted = true;
            redactions[redaction].isTouched = true;
            if (!IsSpreadSheet) {
                redactions[redaction].Red.css({ "background-color": "red" });
            }
        }
        saveRedactions(false, null, false);
    }

};
var OnRedactionRecover = function (s, e) {
    RecoverRedactionsConfirmationPopup.Hide();
    if (IsSpreadSheet) {
        showActivetab = false;
    }
    if (redactionTable.GetSelectedKeysOnPage().length > 0) {
        redactionTable.GetSelectedFieldValues("clientRedactionId", function (values) {
            for (var i = 0; i < values.length; i++) {
                redactions.filter(someobject => someobject.clientRedactionId == values[i])
                    .forEach(someobject => {
                        someobject.deleted = false;
                        someobject.isDeleted = false;
                        someobject.isTouched = true;
                        if (!IsSpreadSheet) {
                            someobject.Red.css({ "background-color": "green" });
                        }
                    });
            }
            saveRedactions(false, null, false);
        })
    }
    else {
        var currentId = lastFocusedId;
        var redaction = redactions.findIndex(obj => obj.clientRedactionId == currentId);
        if (IsSpreadSheet) {
            redactionTable.GetRowValues(redaction, 'GroupId', function (value) {
                if (redaction != -1) {
                    if (redactions[redaction].isDeleted) {
                        redactions.filter(someobject => someobject.GroupId == value)
                            .forEach(someobject => {
                                someobject.deleted = false;
                                someobject.isDeleted = false;
                                someobject.isTouched = true;
                            });
                    }
                    else {
                        redactions.filter(someobject => someobject.GroupId == value)
                            .forEach(someobject => {
                                someobject.deleted = true;
                                someobject.isDeleted = true;
                                someobject.isTouched = true;
                                someobject.Approved = false;
                            });
                    }
                    saveRedactions(false, null, false);
                }
            });
        }
        else {
            if (redaction != -1) {
                if (redactions[redaction].isDeleted) {
                    redactions[redaction].deleted = false;
                    redactions[redaction].isDeleted = false;
                    redactions[redaction].isTouched = true;
                    if (!IsSpreadSheet) {
                        redactions[redaction].Red.css({ "background-color": "green" });
                        redactions[redaction].Red.show();
                    }
                }
                else {
                    redactions[redaction].deleted = true;
                    redactions[redaction].isDeleted = true;
                    redactions[redaction].Approved = false;
                    redactions[redaction].isTouched = true;
                    if (!IsSpreadSheet) {
                        redactions[redaction].Red.css({ "background-color": "red" });
                    }
                }
                saveRedactions(false, null, false);

            }
        }
    }
}
var saveRedactions = function (isApplyAndSave, copy, isDeleteAllRedactions) {
    if (isDeleteAllRedactions || isApplyAndSave) {
        redact_loading.Show();
    }
    unSavedChanges = true;
    var formData = new FormData();
    var postRedactions = redactions;
    if (!isApplyAndSave) {
        postRedactions = postRedactions.filter((obj) => {
            return obj.isTouched === true;
        });
    }
    formData.append("rm.roomId", roomId);
    formData.append("rm.folderId", folderId);
    formData.append("rm.docId", docId);
    formData.append("rm.versionNumber", versionNumber);
    formData.append("rm.signalRConnectionId", signalRConnectionId);
    formData.append("rm.isApplyAndSave", isApplyAndSave);
    formData.append("rm.isDeleteAllRedactions", isDeleteAllRedactions);
    if (IsSpreadSheet) {
        formData.append("rm.isSpreadSheet", true);
        formData.append("rm.isNew", false);
    }
    if (copy != null) {
        formData.append("rm.isNew", copy.data("isNew"));
        formData.append("rm.clientRedactionId", copy.data("clientRedactionId"));
        postRedactions = postRedactions.filter((obj) => {
            return obj.clientRedactionId === copy.data("clientRedactionId");
        });
    }

    postRedactions.forEach(function (elem, ind) {

        formData.append("rm.lrsm[" + ind + "].type", 0);
        if (IsSpreadSheet) {
            formData.append("rm.lrsm[" + ind + "].CellName", elem.CellName);
            formData.append("rm.lrsm[" + ind + "].SheetName", elem.SheetName);
            formData.append("rm.lrsm[" + ind + "].ColumnIndex", elem.ColumnIndex);
            formData.append("rm.lrsm[" + ind + "].RowIndex", elem.RowIndex);
            formData.append("rm.lrsm[" + ind + "].GroupId", elem.GroupId);
            formData.append("rm.lrsm[" + ind + "].IsSpreadSheet", true);
        }
        else {
            formData.append("rm.lrsm[" + ind + "].width", elem.width);
            formData.append("rm.lrsm[" + ind + "].actualWidth", elem.width);
            formData.append("rm.lrsm[" + ind + "].height", elem.height);
            formData.append("rm.lrsm[" + ind + "].top", elem.top);
            formData.append("rm.lrsm[" + ind + "].left", elem.left);
            formData.append("rm.lrsm[" + ind + "].actualLeft", elem.left);
        }

        formData.append("rm.lrsm[" + ind + "].page", elem.page);
        formData.append("rm.lrsm[" + ind + "].deleted", elem.deleted);
        formData.append("rm.lrsm[" + ind + "].Approved", elem.Approved);
        formData.append("rm.lrsm[" + ind + "].Text", elem.Text);
        formData.append("rm.lrsm[" + ind + "].Id", elem.Id);
        formData.append("rm.lrsm[" + ind + "].ClientRedactionId", elem.clientRedactionId);

    });

    $.post({
        url: Url.applyAndSaveReds,
        async: true,
        data: formData,
        processData: false,
        contentType: false,
        error: function (data, textStatus, errorThrown) {
            console.log(data);
        },

        success: function (res, status, xhr) {
            if (!res.succeed) return;
            if (IsSpreadSheet) {
                var spreadSheetModel = new Object();
                spreadSheetModel.roomId = roomId;
                spreadSheetModel.folderId = folderId;
                spreadSheetModel.docId = docId;
                spreadSheetModel.versionNumber = 1;
                spreadSheetModel.signalRConnectionId = signalRConnectionId;
                spreadSheetModel.isApplyAndSave = false;
                spreadSheetModel.ChangeFilePath = true;
                Spreadsheet.PerformCallback({ spreadSheetModel: spreadSheetModel });
            }
            else {
                redactionTable.PerformCallback({ roomId: roomId, folderId: folderId, docId: docId });

            }

            if (res.data.length == 0) {
                redactions = new Array();
            }
            $.each(res.data, function (ind, elem) {
                var redaction = redactions.findIndex(obj => obj.clientRedactionId == elem.clientRedactionId);
                if (redaction != -1) {
                    redactions[redaction].Id = elem.Id;
                    redactions[redaction].Approved = isApplyAndSave;
                    redactions[redaction].isTouched = false;
                    redactions[redaction].isDeleted = elem.isDeleted;
                    redactions[redaction].TextModifiedDate = new Date(parseInt(elem.TextModifiedDate.replace('/Date(', '')));
                }
            })
            // EnableDisableButtons();
        }
    });
}
var markRedNotSaved = function (copy, saveToDB = true) {
    if (copy != null) {
        copy.css({ "background-color": "green" });
        if (copy.data("deleted")) {
            copy.css({ "background-color": "red" });
        }
    }
    if (saveToDB == true) {
        saveRedactions(false, copy, false);
    }

};
var onApplyAndSaveRed_OnClick = function (s, e) {
    if (UploadedNewVersion) {
        alert("You cannot save redactions while uploading new version!");
    }
    else {
        FinalizeRedactionsConfirmationPopup.Hide();
        lastFocusedId = '';
        if (!IsSpreadSheet) {
            var deletedRedactions = redactions.filter((o) => {
                return o.deleted === true;
            });
            $.each(deletedRedactions, function (x, y) {
                y.Red.remove();
            });
            var approvedRedactions = redactions.filter((o) => {
                return o.deleted === false;
            });

            $.each(approvedRedactions, function (x, y) {

                y.Red.css({ "background-color": "lightgray" });
            });
        }
        else {
            showActivetab = false;
        }

        saveRedactions(true, null, false);

    }
};
var OnChangeRedactionLabel = function (s, e) {
    ChangeRedactLabelPopup.Hide();
    if (IsSpreadSheet) {
        showActivetab = false;
    }
    if (redactionTable.GetSelectedKeysOnPage().length > 0) {
        redactionTable.GetSelectedFieldValues("clientRedactionId", function (values) {
            for (var i = 0; i < values.length; i++) {
                redactions.filter(someobject => someobject.clientRedactionId == values[i])
                    .forEach(someobject => {
                        someobject.Text = txtRedactionLabel.GetValue();
                        someobject.isTouched = true;
                        someobject.Approved = false;
                        if (!IsSpreadSheet) {
                            someobject.Red.css({ "background-color": "green" });
                            $(someobject.Red).find(".red-fit").text(txtRedactionLabel.GetValue())
                        }
                    });
            }
            saveRedactions(false, null, values.length.length === redactions.length);
        })

    }
    else {
        if (lastFocusedId != '') {
            var currentId = lastFocusedId;
            var redaction = redactions.findIndex(obj => obj.clientRedactionId == currentId);
            if (redaction != -1) {
                redactions[redaction].Text = txtRedactionLabel.GetValue();
                redactions[redaction].Approved = false;
                redactions[redaction].isTouched = true;
                saveRedactions(false, null, false);
            }
        }
    }

}
// #endregion

// #region Others Events

function LoadRedactionGrid() {
    $.each(redactionTable.cpMasterdata, function (index, item) {
        var index = redactions.findIndex(obj => obj.clientRedactionId == item.clientRedactionId);
        if (index < 0) {
            var redaction = new Object();
            if (!IsSpreadSheet) {
                redaction.top = item.top;
                redaction.left = item.left;
                redaction.width = item.width;
                redaction.height = item.height;
            }
            else {
                redaction.SheetName = item.SheetName;
                redaction.CellName = item.CellName;
                redaction.RowIndex = item.RowIndex;
                redaction.ColumnIndex = item.ColumnIndex;
                redaction.GroupId = item.GroupId;
            }
            redaction.isNew = false;
            redaction.deleted = item.isDeleted;
            redaction.isDeleted = item.isDeleted;
            redaction.clientRedactionId = item.clientRedactionId;
            redaction.page = item.page;
            redaction.Approved = item.Approved;
            redaction.Id = item.Id;
            redaction.type = item.Type;
            redaction.Text = item.Text;
            redaction.isTouched = false;
            redaction.Red = "";
            redaction.TextModifiedDate = item.TextModifiedDate;
            redactions.push(redaction);
        }

    })
    if (IsSpreadSheet) {
        redactions.sort((a, b) => {
            if (a.page !== b.page) {
                return a.page - b.page;
            }
            if (a.RowIndex !== b.RowIndex) {
                return a.RowIndex - b.RowIndex;
            }
            return a.ColumnIndex - b.ColumnIndex;
        });
    }
    else {
        redactions.sort((a, b) => {
            if (a.page !== b.page) {
                return a.page - b.page;
            }
            if (a.top !== b.top) {
                return a.top - b.top;
            }
            return a.left - b.left;
        });
    }

    EnableDisableButtons();
}
function RedactionLabel_keypress() {
    btnChangeRedactionLabelOk.SetEnabled(txtRedactionLabel.GetValue() !== null);
}
function RedactPages_keypress(s, e) {
    if (/[a-zA-Z]/g.test(txtPagestoRedact.GetValue())) {
        console.log('char')
        txtPagestoRedact.SetIsValid(false);
        txtPagestoRedact.SetErrorText('Invalid Characters');
        btnRedactPagesOk.SetEnabled(false)
        return;
    }
    if (txtPagestoRedact.GetValue() == 0) {
        console.log('zero')
        txtPagestoRedact.SetIsValid(false);
        txtPagestoRedact.SetErrorText('Invalid Page Number');
        btnRedactPagesOk.SetEnabled(false)
        return;
    }
    btnRedactPagesOk.SetEnabled(txtRedactionTex.GetValue() !== null && txtPagestoRedact.GetValue() !== null && txtPagestoRedact.GetValue() !== "0");
}
var OnRedactPages = function (s, e) {
    var redactionText = stickyRedactionLabel;

    if (redactions.length > 0) {
        var maxLastseen = redactions.sort((a, b) => Date.parse(b.TextModifiedDate) - Date.parse(a.TextModifiedDate))[0];
        redactionText = maxLastseen.Text;
    }
    else {
        redactionText = stickyRedactionLabel
    }
    txtPagestoRedact.SetValue("");
    txtPagestoRedact.SetFocus();
    txtRedactionTex.SetValue(redactionText);
    RedactPagesPopup.Show();
}
var btnRedactPages_OnClick = function () {
    var isValid = true;
    var pagesRange = txtPagestoRedact.GetValue();
    var pagesArray = new Array();
    var commasepratedPages = pagesRange.split(',');
    var viewerElem = $(documentViewer.instance.docViewer.pM);
    var totalPages = viewerElem.find(".pageSection").length;
    var vf = $(documentViewer.element),
        vfo = vf.offset();
    if (commasepratedPages.length > 0) {
        $.each(commasepratedPages, function (ind, value) {
            var highfunSeprated = value.split('-');
            if (highfunSeprated.length > 1) {
                if (highfunSeprated[1] > totalPages || highfunSeprated[0] == "0") {
                    isValid = false;
                    txtPagestoRedact.SetIsValid(false);
                    txtPagestoRedact.SetErrorText('Invalid Page Number');
                    btnRedactPagesOk.SetEnabled(false)
                    return;
                }
                if (highfunSeprated[1] > highfunSeprated[0]) {
                    var endValue = parseInt(highfunSeprated[0]);
                    pagesArray.push(endValue)
                    while (endValue < parseInt(highfunSeprated[1])) {
                        endValue = endValue + 1;
                        pagesArray.push(endValue)
                    }
                }

            }
            else {
                if (value > totalPages || value == "0") {
                    isValid = false
                    return;
                }
                else {
                    pagesArray.push(parseInt(value))
                }

            }
        });
    }

    if (pagesArray.length > 0 && isValid) {
        pagesArray = pagesArray.filter((item,
            index) => pagesArray.indexOf(item) === index);
        if (pagesArray.length > 0) {
            redact_loading.Show();
        }
        $.each(pagesArray, function (ind, value) {
            var pcs = viewerElem.find("#pageSection" + (parseInt(value) - 1));
            var copy = $(helperRedStr);

            var redaction = new Object();
            redaction.top = 0;
            redaction.left = 0;
            redaction.width = 100;
            redaction.height = 100;
            redaction.isNew = false;
            redaction.deleted = false;
            redaction.isDeleted = false;
            redaction.clientRedactionId = Utils.uuidv4();
            redaction.page = value;
            redaction.Approved = false;
            redaction.Id = 0;
            redaction.isTouched = true;
            redaction.type = 0;
            redaction.Text = txtRedactionTex.GetValue();
            redaction.Red = copy;
            redaction.RedactPages = pagesArray;
            redaction.IsRedactFullPage = true;
            redactions.push(redaction);
            copy.data("clientRedactionId", redaction.clientRedactionId);
            initRedactionEvents(copy, viewerElem);
            initRedactionDraggable(copy, viewerElem, vfo);
            initRedactionResizable(copy, pcs, vf);
            initRedactionFitty(copy, txtRedactionTex.GetValue());
            pcs.append(copy.css({
                top: 0 + "%",
                left: 0 + "%",
                width: 100 + "%",
                height: 100 + "%",
                "background-color": "Green"
            }).addClass("moved"));
        });
        saveRedactions(false, null, false);
        redact_loading.Hide();
        RedactPagesPopup.Hide();
    }
    else {
        txtPagestoRedact.SetIsValid(false);
        txtPagestoRedact.SetErrorText('Invalid Page Number');
        btnRedactPagesOk.SetEnabled(false)
    }

}
function SetSpreadsheetSelection(spreadsheet, cellColIndex, cellRowIndex) {
    var cellColVisibleIndex = spreadsheet.getPaneManager().convertModelIndexToVisibleIndex(cellColIndex, true),
        cellRowVisibleIndex = spreadsheet.getPaneManager().convertModelIndexToVisibleIndex(cellRowIndex, false);
    if (cellRowVisibleIndex >= 0 && cellColVisibleIndex >= 0) // Cell exists on the client-side  
        spreadsheet.setSelection(cellColVisibleIndex, cellRowVisibleIndex, cellColVisibleIndex, cellRowVisibleIndex);

}
function OnRowClick(s, index) {
    var currentId = redactionTable.GetRowKey(index);

    var redaction = redactions.findIndex(obj => obj.clientRedactionId == currentId);
    if (redaction != -1) {
        if (!IsSpreadSheet) {
            redactions[redaction].Red.css({ "background-color": "yellow" });
            if (lastFocusedId != '' && !IsSpreadSheet) {
                ChangeRedactionColor(lastFocusedId);
            }
            redactionTable.SetFocusedRowIndex(redaction)
            scrollContent(redactions[redaction].Red);
        }
        else {
            showActivetab = true;
            var colindex = redactions[redaction].ColumnIndex;
            var rowindex = redactions[redaction].RowIndex;
            var spreadSheetModel = new Object();
            spreadSheetModel.roomId = 0;
            spreadSheetModel.folderId = 0;
            spreadSheetModel.docId = 0;
            spreadSheetModel.versionNumber = 1;
            spreadSheetModel.signalRConnectionId = '';
            spreadSheetModel.isApplyAndSave = false;
            spreadSheetModel.ChangeFilePath = false;
            spreadSheetModel.setFocusedCell = true;
            spreadSheetModel.rowIndex = rowindex;
            spreadSheetModel.columnIndex = colindex;
            spreadSheetModel.activePage = redactions[redaction].page;
            if (lastFocusedId != '' && lastFocusedId !== currentId) {
                var lastUsedCell = redactions.findIndex(obj => obj.clientRedactionId == lastFocusedId);
                if (lastUsedCell != -1) {
                    spreadSheetModel.LastFocusedRedaction = redactions[lastUsedCell];
                }
            }
            Spreadsheet.PerformCallback({ spreadSheetModel: spreadSheetModel }, function () {
                SetSpreadsheetSelection(Spreadsheet, colindex, rowindex);
            });

        }
    }
    lastFocusedId = currentId;
    EnableDisableButtons();
}
var btnCancelRedactPages_OnClick = function () {
    RedactPagesPopup.Hide();
}
function ChangeRedactionColor(lastFocusedId) {
    var redaction = redactions.findIndex(obj => obj.clientRedactionId == lastFocusedId);
    if (redaction != -1) {
        let redactionColor = "green";
        if (redactions[redaction].Approved == true) {
            redactionColor = "lightgray";
        }
        if (redactions[redaction].isDeleted == true && redactions[redaction].Approved == false) {
            redactionColor = "red";
        }
        redactions[redaction].Red.css({ "background-color": redactionColor });
    }
    return redaction;
}

function OpenRedaction(docId) {
    var currLocation = location.pathname;
    location.href = currLocation + "?signalRConnectionId=" + signalRConnectionId + "&roomId=" + roomId + "&searchId=undefined&folderId=" + folderId
        + "&docId=" + docId + "&versionNumber=null&textSelectionEnabled=true&viewer=0&fromSignalR=null&docMode=view&productionId=null&redactMode=true&highlitedHtmlFailed=false&isSlipsheet=false&productionKey=null&reviewSetId=null"
}
var scrollContent = function (elem) {
    var docScroll = $(documentViewer.instance.docViewer.WK);
    var cst = docScroll.scrollTop();
    docScroll.animate({
        scrollTop: elem.offset().top + cst - 100
    }, 1000, function () {
        elem.focus();
    });

};
function CheckedChanged(s, e) {
    if (excelMode) {
        excelMode = false;
    }
    else {
        excelMode = true;
    }
    var spreadSheetModel = new Object();
    spreadSheetModel.roomId = roomId;
    spreadSheetModel.folderId = folderId;
    spreadSheetModel.docId = docId;
    spreadSheetModel.versionNumber = 1;
    spreadSheetModel.signalRConnectionId = signalRConnectionId;
    spreadSheetModel.isApplyAndSave = false;
    spreadSheetModel.ChangeFilePath = false;
    spreadSheetModel.toogleSheet = true;
    spreadSheetModel.showOriginalContent = excelMode;
    spreadSheetModel.IsSelectedCells = s.GetChecked() == true;
    Spreadsheet.PerformCallback({ spreadSheetModel: spreadSheetModel });
    if (excelMode) {
        excelMode = false;
    }
    else {
        excelMode = true;
    }
}
var OnEndCallback = function (s, e)
{
    if (isSheetChanged) {
        redactionTable.SetFocusedRowIndex(focusedRowIndex);
        if (IsSpreadSheet) {
            OnRowClick(s, focusedRowIndex);
        }
        
        isSheetChanged = false;
    }

    LoadRedactionGrid();

    if (Object.keys(redactionTable.cpMasterdata).length > 0) {
        var grida = Object.values(redactionTable.cpMasterdata);
        redactions = redactions.filter((el) => {
            return grida.find((f) => {
                return f.clientRedactionId === el.clientRedactionId;
            });
        });

    }
    else {
        redactions = new Array();
    }
    if (redact_loading.GetVisible()) {
        redact_loading.Hide();
    }
    EnableDisableButtons();
}
function EnableDisableButtons() {
    if (IsSpreadSheet && redactions.length > 0) {
        btnSeeOriginal.SetEnabled(true);
    }
    if (redactionTable.GetSelectedKeysOnPage().length > 0) {
        btnChangeLabel.SetEnabled(true);
        if (redactions.some((o) => o.isDeleted === false)) {
            btnDeleteAllRedactions.SetEnabled(true);
        }
        else {
            btnDeleteAllRedactions.SetEnabled(false);
        }
        if (redactions.some((o) => o.isDeleted === true)) {
            btnRecoverRedaction.SetEnabled(true);
        }
        else {
            btnRecoverRedaction.SetEnabled(false);
        }
        if (redactions.some((o) => o.Approved === false)) {
            btnRedactApplySave.SetEnabled(true);
        }
        else {
            btnRedactApplySave.SetEnabled(false);
        }

    }
    else {
        if (lastFocusedId != '') {
            var redaction = redactions.findIndex(obj => obj.clientRedactionId == lastFocusedId);
            if (redaction != -1) {
                btnChangeLabel.SetEnabled(true);
                if (redactions[redaction].isDeleted) {
                    btnDeleteAllRedactions.SetEnabled(false);
                    btnRecoverRedaction.SetEnabled(true);
                }
                else {
                    btnDeleteAllRedactions.SetEnabled(true);
                    btnRecoverRedaction.SetEnabled(false);
                }
                if (redactions[redaction].Approved === false) {
                    btnRedactApplySave.SetEnabled(true);
                }
                else {
                    btnRedactApplySave.SetEnabled(false);
                }
            }
        }
        else {
            btnChangeLabel.SetEnabled(false);
            btnDeleteAllRedactions.SetEnabled(false);
        }
    }
}
// #endregion

