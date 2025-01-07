((m) => {

  const DocumentState = {
    COMPLETE:    "complete",
    LOADING:     "loading",
    INTERACTIVE: "interactive"
  };

  const DefaultConfig = {
    DEFUALT_CONTAINER_SELECTOR: "item-dragger-container",
    DEFUALT_ITEM_CLASS:         "item-dragger-item",
    ITEMS_PER_ROW: 3
  };

  class IconDragger {

    constructor(config) {
      this.config               = config || {};
      this.containerSelector    = this.config.selector || DefaultConfig.DEFUALT_CONTAINER_SELECTOR;
      this.container            = domSelect(this.config.selector);
      this.itemBuilder          = this.config.itemBuilder;
      this.config.margin        = this.config.margin || {right: 0, bottom: 0};

      this.marginRight          = this.config.margin.right;
      this.marginBottom         = this.config.margin.bottom;


      if (typeof this.itemBuilder !== "function") {
        this.itemBuilder = (builder) => builder({
          tagName: "div",
          classList: [DefaultConfig.DEFUALT_ITEM_CLASS]
        });
      }

      this.domBuilder = createDomBuilder();

      this.appendContainerLater    = false;
      this.deferComputeElementSize = false;

      if (!this.container)
          this.container = domCreateElement(this.containerSelector, null, {position: "relative"});

      this.attachContainer();

      this.elementSize     = null;
      this.rowElementCount = DefaultConfig.ITEMS_PER_ROW;

      this.mouseState      = {x: undefined, y: undefined, down: false};

      this.ordering        = [];
      this.startGridIndex  = -1;
      this.draggingElement = null;

      this.hitOffsetX      = 0;
      this.hitOffsetY      = 0;


      window.addEventListener("DOMContentLoaded", () => {this.onDocumentLoaded()});
      window.addEventListener("mousemove", this.onMouseMove.bind(this));
      window.addEventListener("mouseup", this.onMouseUp.bind(this));
      window.addEventListener("mousedown", this.onMouseDown.bind(this));
    }

    onAnimationFrame() {
      this.updateFrame();

      requestAnimationFrame(this.onAnimationFrame.bind(this));
    }

    updateFrame() {
      if (!this.draggingElement) {
        if (this.mouseState.down) {
            const j = Math.floor(this.mouseState.x / this.elementSize.width);
            const i = Math.floor(this.mouseState.y / this.elementSize.height);

            if (j >= this.rowElementCount || j < 0)
              return;

            const index = i * this.rowElementCount + j;
            if (index < 0 || index >= this.ordering.length)
              return;

            const currX = j * this.elementSize.width;
            const currY = i * this.elementSize.height;


            this.draggingElement = this.container.children[this.ordering[index]];
            this.hitOffsetX      = this.mouseState.x - currX;
            this.hitOffsetY      = this.mouseState.y - currY;

            this.draggingElement.classList.add("mouse-dragging");
            this.startGridIndex  = index;
            this.container.classList.add("dragging-mode");
        }
      } else {

        if (!this.mouseState.down) {
          this.container.classList.remove("dragging-mode");
          // .move

          const [j, i] = this.gridLocation(this.startGridIndex);
          const x = j * this.elementSize.width;
          const y = i * this.elementSize.height;

          this.draggingElement.classList.add("move");
          this.draggingElement.classList.remove("mouse-dragging");
          this.draggingElement.style.transform = `translate(${x}px, ${y}px)`;;

          this.draggingElement = null;
          return;
        }

        this.draggingElement.classList.remove("move");
        const {x, y} = this.mouseState;

        this.updateGridOrdering();

        this.draggingElement.style.transform = `translate(${x - this.hitOffsetX}px, ${y - this.hitOffsetY}px)`;
      }
    }

    updateGridOrdering() {
      const {x, y} = this.mouseState;

      const centerX = (x - this.hitOffsetX) + this.elementSize.width  * .5,
            centerY = (y - this.hitOffsetY) + this.elementSize.height * .5;

      const endIndex_j = Math.floor(centerX / this.elementSize.width);
      const endIndex_i = Math.floor(centerY / this.elementSize.height);

      if (endIndex_j < 0 || endIndex_j >= this.rowElementCount)
        return;

      if (endIndex_i < 0)
        return;

      const endGridIndex = endIndex_i * this.rowElementCount + endIndex_j;

      if (endGridIndex < 0 || endGridIndex >= this.ordering.length)
        return;

      if (this.startGridIndex != endGridIndex) {
        const dir = (endGridIndex - this.startGridIndex) / Math.abs(endGridIndex - this.startGridIndex);

        // [0, 1, 2, 3, ...] <-- ordering array
        //  ^ (startGridIndex)
        //        ^  (endGridIndex)
        const spannedElements   = (endGridIndex - this.startGridIndex) * dir;
        const startElementIndex = this.ordering[this.startGridIndex];

        for (let i = 0; i < spannedElements; ++i) {
            const probe = i * dir + this.startGridIndex;

            // actually, this is not needed
            // if (dir > 0) {
            //   if (probe + 1 >= this.ordering.length)
            //     break;
            // } else {
            //   if (probe - 1 < 0)
            //     break;
            // }

            this.ordering[probe] = this.ordering[probe + 1 * dir];

            const element = this.container.children[this.ordering[probe]];
            const [jLoc, iLoc] = this.gridLocation(probe);

            if (!element)
              continue;

            element.classList.add("move");
            element.style.transform = `translate(${jLoc * this.elementSize.width}px, ${iLoc * this.elementSize.height}px)`;
        }

        this.ordering[endGridIndex] = startElementIndex;
        this.startGridIndex = endGridIndex;
      }
    }

    onMouseMove(e) {
      const rect = this.container.getBoundingClientRect();

      this.mouseState.x = e.clientX - rect.x;
      this.mouseState.y = e.clientY - rect.y;
    }

    onMouseDown() {
      this.mouseState.down = true;
    }

    onMouseUp() {
      this.mouseState.down = false;
    }

    buildItem() {
      const item = this.itemBuilder(this.domBuilder);
      item.style.position = "absolute";
      return item;
    }

    addItem() {
      const item = this.buildItem();

      const index = this.container.children.length;

      this.container.appendChild(item);
      this.ordering.push(index);

      if (!this.elementSize)
        this.computeElementSize();

      const [j, i] = this.gridLocation(index);

      const x = j * this.elementSize.width;
      const y = i * this.elementSize.height;

      item.style.transform = `translate(${x}px, ${y}px)`;
    }

    gridLocation(index) {
      const j = index % this.rowElementCount;
      return [
        j,
        (index - j) / this.rowElementCount
      ];
    }

    attachContainer() {
      if (document.readyState != DocumentState.COMPLETE) {
       this.appendContainerLater = true;
      } else {
        document.body.appendChild(this.container);
      }
    }

    onDocumentLoaded() {
      if (this.appendContainerLater)
        document.body.appendChild(this.container);

      if (this.deferComputeElementSize) {
        this.deferComputeElementSize = false;
        
        this.computeElementSize();
        this.updateItemsPosition();
      }

      requestAnimationFrame(this.onAnimationFrame.bind(this));
    }

    updateItemsPosition() {
      for (let ind = 0; ind < this.container.children.length; ++ind) {
        const element = this.container.children[ind];

        const [j, i] = this.gridLocation(ind);

        const x = j * this.elementSize.width;
        const y = i * this.elementSize.height;

        element.style.transform = `translate(${x}px, ${y}px)`;
      }
    }

    computeElementSize() {
      if (document.readyState == DocumentState.LOADING) {
        this.deferComputeElementSize = true;
        this.elementSize = {
          width: 0,
          height: 0
        }
      }
      else {
        if (this.container.children.length > 0) {
            const element = this.container.children[0];

            const rect    = element.getBoundingClientRect();
            this.elementSize = {
              width:  rect.width  + this.marginRight,
              height: rect.height + this.marginBottom
            };
        }
      }
    }

    static init(config) {
      return new IconDragger(config);
    }
  }

  function domSelect(selector) {
    return document.querySelector(selector);
  }

  function domCreateElement(tag, classList, style) {
    const element     = document.createElement(tag);

    if (!classList) classList = [];

    for (const cls of classList)
      element.classList.add(cls);

    if (style) {
      for (const k in style)
        element.style[k] = style[k];
    }

    return element;
  }

  function createDomBuilder() {
    const builder = (def) => {
      def.tagName     = def.tagName   || "div";
      def.classList   = def.classList || [];
      def.style       = def.style     || {};
      def.children    = def.children  || [];

      const element = domCreateElement(def.tagName, def.classList, def.style);

      if ("textContent" in def)
        element.textContent = def.textContent;

      for (const child of def.children) {
        const childElement = builder(child);
        element.appendChild(childElement);
      }

      return element;
    };

    return builder;
  }

  m.IconDragger = IconDragger;
})(window);
