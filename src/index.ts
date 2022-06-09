
export class HighlightJsLineNumbers {
  public static readonly TABLE_NAME: string = 'hljs-ln';
  public static readonly LINE_NAME: string = 'hljs-ln-line';
  public static readonly CODE_BLOCK_NAME: string = 'hljs-ln-code';
  public static readonly NUMBERS_BLOCK_NAME: string = 'hljs-ln-numbers';
  public static readonly NUMBER_LINE_NAME: string = 'hljs-ln-n';
  public static readonly DATA_ATTR_NAME: string = 'data-line-number';
  public static readonly BREAK_LINE_REGEXP: RegExp = /\r\n|\r|\n/g;

  public static isHljsLnCodeDescendant(domElt) {
    let curElt = domElt;
    while (curElt) {
      if (curElt.className && curElt.className.indexOf('hljs-ln-code') !== -1) {
        return true;
      }
      curElt = curElt.parentNode;
    }
    return false;
  }
  public static getHljsLnTable(hljsLnDomElt) {
    let curElt = hljsLnDomElt;
    while (curElt.nodeName !== 'TABLE') {
      curElt = curElt.parentNode;
    }
    return curElt;
  }

  public static edgeGetSelectedCodeLines(selection) {
    // current selected text without line breaks
    let selectionText = selection.toString();

    // get the <td> element wrapping the first line of selected code
    let tdAnchor = selection.anchorNode;
    while (tdAnchor.nodeName !== 'TD') {
      tdAnchor = tdAnchor.parentNode;
    }

    // get the <td> element wrapping the last line of selected code
    let tdFocus = selection.focusNode;
    while (tdFocus.nodeName !== 'TD') {
      tdFocus = tdFocus.parentNode;
    }

    // extract line numbers
    let firstLineNumber = parseInt(tdAnchor.dataset.lineNumber);
    let lastLineNumber = parseInt(tdFocus.dataset.lineNumber);

    // multi-lines copied case
    if (firstLineNumber != lastLineNumber) {
      let firstLineText = tdAnchor.textContent;
      let lastLineText = tdFocus.textContent;

      // if the selection was made backward, swap values
      if (firstLineNumber > lastLineNumber) {
        let tmp = firstLineNumber;
        firstLineNumber = lastLineNumber;
        lastLineNumber = tmp;
        tmp = firstLineText;
        firstLineText = lastLineText;
        lastLineText = tmp;
      }

      // discard not copied characters in first line
      while (selectionText.indexOf(firstLineText) !== 0) {
        firstLineText = firstLineText.slice(1);
      }

      // discard not copied characters in last line
      while (selectionText.lastIndexOf(lastLineText) === -1) {
        lastLineText = lastLineText.slice(0, -1);
      }

      // reconstruct and return the real copied text
      let selectedText = firstLineText;
      let hljsLnTable = this.getHljsLnTable(tdAnchor);
      for (let i = firstLineNumber + 1; i < lastLineNumber; ++i) {
        let codeLineSel = this.format('.{0}[{1}="{2}"]', [
          this.CODE_BLOCK_NAME,
          this.DATA_ATTR_NAME,
          i,
        ]);
        let codeLineElt = hljsLnTable.querySelector(codeLineSel);
        selectedText += '\n' + codeLineElt.textContent;
      }
      selectedText += '\n' + lastLineText;
      return selectedText;
      // single copied line case
    } else {
      return selectionText;
    }
  }

  public static addStyles() {
    let css = document.createElement('style');
    css.type = 'text/css';
    css.innerHTML = this.format(
      '.{0}{border-collapse:collapse}' +
        '.{0} td{padding:0}' +
        '.{1}:before{content:attr({2})}',
      [this.TABLE_NAME, this.NUMBER_LINE_NAME, this.DATA_ATTR_NAME]
    );
    document.getElementsByTagName('head')[0].appendChild(css);
  }

  public static initLineNumbersOnLoad(options) {
    if (
      document.readyState === 'interactive' ||
      document.readyState === 'complete'
    ) {
      this.documentReady(options);
    } else {
      window.addEventListener('DOMContentLoaded', function () {
        this.documentReady(options);
      });
    }
  }

  public static documentReady(options) {
    try {
      let blocks = document.querySelectorAll('code.hljs,code.nohighlight');

      for (let i in blocks) {
        if (blocks.hasOwnProperty(i)) {
          if (!this.isPluginDisabledForBlock(blocks[i])) {
            this.lineNumbersBlock(blocks[i], options);
          }
        }
      }
    } catch (e) {
      window.console.error('LineNumbers error: ', e);
    }
  }

  public static isPluginDisabledForBlock(element) {
    return element.classList.contains('nohljsln');
  }

  public static lineNumbersBlock(element, options) {
    if (typeof element !== 'object') return;

    this.async(() => {
      element.innerHTML = this.lineNumbersInternal(element, options);
    });
  }

  public static lineNumbersValue(value, options) {
    if (typeof value !== 'string') return;

    let element = document.createElement('code');
    element.innerHTML = value;

    return this.lineNumbersInternal(element, options);
  }

  public static lineNumbersInternal(element, options) {
    let internalOptions = this.mapOptions(element, options);

    this.duplicateMultilineNodes(element);

    return this.addLineNumbersBlockFor(element.innerHTML, internalOptions);
  }

  public static addLineNumbersBlockFor(inputHtml, options) {
    let lines = this.getLines(inputHtml);

    // if last line contains only carriage return remove it
    if (lines[lines.length-1].trim() === '') {
      lines.pop();
    }

    if (lines.length > 1 || options.singleLine) {
      let html = '';

      for (let i = 0, l = lines.length; i < l; i++) {
        html += this.format(
          '<tr>' +
            '<td class="{0} {1}" {3}="{5}">' +
            '<div class="{2}" {3}="{5}"></div>' +
            '</td>' +
            '<td class="{0} {4}" {3}="{5}">' +
            '{6}' +
            '</td>' +
            '</tr>',
          [
            this.LINE_NAME,
            this.NUMBERS_BLOCK_NAME,
            this.NUMBER_LINE_NAME,
            this.DATA_ATTR_NAME,
            this.CODE_BLOCK_NAME,
            i + options.startFrom,
            lines[i].length > 0 ? lines[i] : ' ',
          ]
        );
      }

      return this.format('<table class="{0}">{1}</table>', [
        this.TABLE_NAME,
        html,
      ]);
    }

    return inputHtml;
  }

  /**
   * @param {HTMLElement} element Code block.
   * @param {Object} options External API options.
   * @returns {Object} Internal API options.
   */
  public static mapOptions(element, options) {
    options = options || {};
    return {
      singleLine: this.getSingleLineOption(options),
      startFrom: this.getStartFromOption(element, options),
    };
  }

  public static getSingleLineOption(options) {
    let defaultValue = false;
    if (!!options.singleLine) {
      return options.singleLine;
    }
    return defaultValue;
  }

  public static getStartFromOption(element, options) {
    let defaultValue = 1;
    let startFrom = defaultValue;

    if (isFinite(options.startFrom)) {
      startFrom = options.startFrom;
    }

    // can be overridden because local option is priority
    let value = this.getAttribute(element, 'data-ln-start-from');
    if (value !== null) {
      startFrom = this.toNumber(value, defaultValue);
    }

    return startFrom;
  }

  /**
   * Recursive method for fix multi-line elements implementation in highlight.js
   * Doing deep passage on child nodes.
   * @param {HTMLElement} element
   */
  public static duplicateMultilineNodes(element) {
    let nodes = element.childNodes;
    for (let node in nodes) {
      if (nodes.hasOwnProperty(node)) {
        let child = nodes[node];
        if (this.getLinesCount(child.textContent) > 0) {
          if (child.childNodes.length > 0) {
            this.duplicateMultilineNodes(child);
          } else {
            this.duplicateMultilineNode(child.parentNode);
          }
        }
      }
    }
  }

  /**
   * Method for fix multi-line elements implementation in highlight.js
   * @param {HTMLElement} element
   */
  public static duplicateMultilineNode(element) {
    let className = element.className;

    if (!/hljs-/.test(className)) return;

    let lines = this.getLines(element.innerHTML);
    let result = '';
    for (let i = 0; i < lines.length; i++) {
      let lineText = lines[i].length > 0 ? lines[i] : ' ';
      result += this.format('<span class="{0}">{1}</span>\n', [
        className,
        lineText,
      ]);
    }

    element.innerHTML = result.trim();
  }

  public static getLines(text) {
    if (text.length === 0) return [];
    return text.split(this.BREAK_LINE_REGEXP);
  }

  public static getLinesCount(text) {
    return (text.trim().match(this.BREAK_LINE_REGEXP) || []).length;
  }

  ///
  /// HELPERS
  ///

  static async(func) {
    window.setTimeout(func, 0);
  }

  /**
   * {@link https://wcoder.github.io/notes/string-format-for-string-formating-in-javascript}
   * @param {string} format
   * @param {array} args
   */
  static format(format, args) {
    return format.replace(/\{(\d+)\}/g, (m, n) => {
      return args[n] !== undefined ? args[n] : m;
    });
  }

  /**
   * @param {HTMLElement} element Code block.
   * @param {String} attrName Attribute name.
   * @returns {String} Attribute value or empty.
   */
  static getAttribute(element, attrName) {
    return element.hasAttribute(attrName)
      ? element.getAttribute(attrName)
      : null;
  }

  /**
   * @param {String} str Source string.
   * @param {Number} fallback Fallback value.
   * @returns Parsed number or fallback value.
   */
  static toNumber(str, fallback) {
    if (!str) return fallback;
    let number = Number(str);
    return isFinite(number) ? number : fallback;
  }
}