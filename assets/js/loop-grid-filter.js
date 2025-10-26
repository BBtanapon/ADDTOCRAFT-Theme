/**
 * Loop Grid Filter - COMPLETE FULLY RESPONSIVE VERSION
 * Supports Elementor breakpoints
 * FIXED: Mobile filter toggle works multiple times
 */

(function ($) {
	"use strict";

	class LoopGridFilter {
		constructor(widgetElement) {
			this.widget = $(widgetElement);
			this.widgetId = this.widget.data("widget-id");
			this.targetId = this.widget.data("target");
			this.targetGrid = null;
			this.debounceTimer = null;

			// Elementor breakpoints
			this.BREAKPOINTS = {
				mobile: 767,
				tablet: 1024,
			};

			// Store UNIQUE products only
			this.uniqueProducts = new Map();

			// Grid properties
			this.gridClasses = "";
			this.gridStyles = "";

			this.currentFilters = {
				search: "",
				sort: "date",
				categories: [],
				tags: [],
				attributes: {},
				minPrice: 0,
				maxPrice: 99999,
			};

			this.init();
		}

		init() {
			console.log(
				"🎯 RESPONSIVE FILTER: Initializing with Product ID deduplication",
			);

			this.findTargetGrid();
			this.setupMobileToggle(); // CRITICAL: Initialize mobile toggle FIRST

			if (!this.targetGrid || !this.targetGrid.length) {
				console.warn("⚠️ Target grid not found");
				return;
			}

			const initFilter = () => {
				if (this.uniqueProducts.size === 0) {
					console.log("📸 Capturing unique products");
					this.captureUniqueProducts();
					this.initPriceSliders();
					this.bindEvents();
				}
			};

			$(document).on("loop-grid-attributes-ready", initFilter);
			setTimeout(initFilter, 2000);
		}

		getDeviceType() {
			const width = window.innerWidth;
			if (width <= this.BREAKPOINTS.mobile) return "mobile";
			if (width <= this.BREAKPOINTS.tablet) return "tablet";
			return "desktop";
		}

		getResponsiveColumns() {
			const deviceType = this.getDeviceType();
			const container = this.targetGrid[0];

			// Try to get from data attributes
			if (container) {
				if (
					deviceType === "mobile" &&
					container.dataset.columnsMobile
				) {
					return parseInt(container.dataset.columnsMobile);
				} else if (
					deviceType === "tablet" &&
					container.dataset.columnsTablet
				) {
					return parseInt(container.dataset.columnsTablet);
				} else if (container.dataset.columns) {
					return parseInt(container.dataset.columns);
				}
			}

			// Fallback defaults
			if (deviceType === "mobile") return 1;
			if (deviceType === "tablet") return 2;
			return 4;
		}

		getResponsiveGap() {
			const deviceType = this.getDeviceType();
			if (deviceType === "mobile") return "15px";
			if (deviceType === "tablet") return "20px";
			return "30px";
		}

		findTargetGrid() {
			if (this.targetId) {
				const selectors = [
					`.elementor-element-${this.targetId} .elementor-loop-container`,
					`[data-id="${this.targetId}"] .elementor-loop-container`,
					`#${this.targetId} .elementor-loop-container`,
					`#${this.targetId}`,
				];

				for (let selector of selectors) {
					this.targetGrid = $(selector);
					if (this.targetGrid.length) {
						console.log("✅ Found grid:", selector);
						break;
					}
				}
			}

			if (!this.targetGrid || !this.targetGrid.length) {
				this.targetGrid = $(".elementor-loop-container").first();
			}

			if (!this.targetGrid.hasClass("elementor-loop-container")) {
				const container = this.targetGrid
					.find(".elementor-loop-container")
					.first();
				if (container.length) {
					this.targetGrid = container;
				}
			}
		}

		captureUniqueProducts() {
			this.gridClasses = this.targetGrid.attr("class") || "";
			this.gridStyles = this.targetGrid.attr("style") || "";

			console.log("📦 Capturing products...");

			this.uniqueProducts.clear();

			const items = this.targetGrid.find(
				'.e-loop-item, .product-loop-item, [class*="product-id-"]',
			);

			console.log(`   Found ${items.length} DOM elements`);

			let skippedDuplicates = 0;

			items.each((index, element) => {
				const $element = $(element);
				const productId = this.extractProductId($element);

				if (!productId) {
					console.warn(`   ⚠️ Item ${index} has no product ID`);
					return;
				}

				if (this.uniqueProducts.has(productId)) {
					console.log(
						`   🚫 Skipping duplicate product ID: ${productId} (item ${index})`,
					);
					skippedDuplicates++;
					return;
				}

				const productData = this.extractProductData($element);

				this.uniqueProducts.set(productId, {
					id: productId,
					element: element.cloneNode(true),
					data: productData,
					index: this.uniqueProducts.size,
				});

				console.log(
					`   ✅ Stored product ${productId} (${productData.title || "No title"})`,
				);
			});

			console.log(
				`\n✅ Captured ${this.uniqueProducts.size} UNIQUE products`,
			);
			if (skippedDuplicates > 0) {
				console.log(
					`   🚫 Skipped ${skippedDuplicates} duplicate items`,
				);
			}
		}

		extractProductId($element) {
			let id =
				$element.data("product-id") || $element.attr("data-product-id");
			if (id && id !== "{{ post.id }}") {
				return String(id);
			}

			const classes = $element.attr("class") || "";
			const patterns = [
				/product-id-(\d+)/,
				/e-loop-item-(\d+)/,
				/post-(\d+)/,
				/elementor-post-(\d+)/,
			];

			for (const pattern of patterns) {
				const match = classes.match(pattern);
				if (match) {
					return String(match[1]);
				}
			}

			return null;
		}

		extractProductData($element) {
			const data = {
				id: this.extractProductId($element),
				title: "",
				categories: [],
				tags: [],
				attributes: {},
				price: 0,
			};

			// Title - try multiple sources
			const $title = $element
				.find(
					".elementor-heading-title, h2, h3, h4, .product-title, .woocommerce-loop-product__title",
				)
				.first();
			if ($title.length) {
				data.title = $title.text().trim().toLowerCase();
			}

			// Fallback to data attribute
			if (!data.title) {
				data.title = (
					$element.data("title") ||
					$element.attr("data-title") ||
					""
				).toLowerCase();
			}

			// Categories
			const cats =
				$element.data("categories") || $element.attr("data-categories");
			if (cats) {
				data.categories = String(cats)
					.split(",")
					.map((c) => c.trim())
					.filter((c) => c);
			}

			// Tags
			const tags = $element.data("tags") || $element.attr("data-tags");
			if (tags) {
				data.tags = String(tags)
					.split(",")
					.map((t) => t.trim())
					.filter((t) => t);
			}

			// Attributes
			const dataset = $element[0].dataset || {};
			Object.keys(dataset).forEach((key) => {
				if (
					[
						"productId",
						"title",
						"price",
						"regularPrice",
						"salePrice",
						"categories",
						"tags",
						"minPrice",
						"maxPrice",
					].includes(key)
				) {
					return;
				}

				let attrName = key;
				if (attrName.startsWith("pa") && attrName.length > 2) {
					if (attrName[2] === attrName[2].toUpperCase()) {
						attrName = attrName
							.replace(/([A-Z])/g, "_$1")
							.toLowerCase();
					}
				}

				const value = dataset[key];
				if (value) {
					data.attributes[attrName] = String(value)
						.split(",")
						.map((v) => v.trim().toLowerCase())
						.filter((v) => v);
				}
			});

			// Price
			const price = parseFloat(
				$element.data("price") || $element.attr("data-price") || 0,
			);
			const regularPrice = parseFloat(
				$element.data("regular-price") ||
					$element.attr("data-regular-price") ||
					0,
			);
			const salePrice = parseFloat(
				$element.data("sale-price") ||
					$element.attr("data-sale-price") ||
					0,
			);
			const minPrice = parseFloat(
				$element.data("min-price") ||
					$element.attr("data-min-price") ||
					0,
			);

			data.price = price || salePrice || regularPrice || minPrice || 0;

			return data;
		}

		initPriceSliders() {
			const minSlider = this.widget.find(".loop-price-min-slider");
			const maxSlider = this.widget.find(".loop-price-max-slider");

			if (!minSlider.length || !maxSlider.length) return;

			const maxPrice = parseInt(maxSlider.attr("max")) || 10000;
			this.currentFilters.maxPrice = maxPrice;

			minSlider.on("input", () => this.updatePriceDisplay());
			maxSlider.on("input", () => this.updatePriceDisplay());

			this.updatePriceDisplay();
		}

		updatePriceDisplay() {
			const minSlider = this.widget.find(".loop-price-min-slider");
			const maxSlider = this.widget.find(".loop-price-max-slider");
			const minVal = parseInt(minSlider.val()) || 0;
			const maxVal = parseInt(maxSlider.val()) || 10000;

			if (minVal > maxVal - 100) {
				minSlider.val(maxVal - 100);
				return;
			}

			this.widget
				.find(".price-min-value")
				.text("฿" + minVal.toLocaleString());
			this.widget
				.find(".price-max-value")
				.text("฿" + maxVal.toLocaleString());
			this.widget.find(".loop-price-min-input").val(minVal);
			this.widget.find(".loop-price-max-input").val(maxVal);

			const maxAttr = parseInt(maxSlider.attr("max")) || 10000;
			const minPercent = (minVal / maxAttr) * 100;
			const maxPercent = (maxVal / maxAttr) * 100;

			this.widget.find(".price-slider-track").css({
				left: minPercent + "%",
				width: maxPercent - minPercent + "%",
			});

			this.currentFilters.minPrice = minVal;
			this.currentFilters.maxPrice = maxVal;
		}

		bindEvents() {
			// Search
			this.widget.find(".loop-filter-search").on(
				"input",
				this.debounce(() => {
					this.currentFilters.search = this.widget
						.find(".loop-filter-search")
						.val()
						.toLowerCase()
						.trim();
					this.applyFilters();
				}, 500),
			);

			// Sort
			this.widget.find(".loop-filter-sort").on("change", () => {
				this.currentFilters.sort = this.widget
					.find(".loop-filter-sort")
					.val();
				this.applyFilters();
			});

			// Categories
			this.widget.on("change", ".loop-filter-category", () => {
				this.updateCheckboxArray("categories", ".loop-filter-category");
				this.applyFilters();
			});

			// Tags
			this.widget.on("change", ".loop-filter-tag", () => {
				this.updateCheckboxArray("tags", ".loop-filter-tag");
				this.applyFilters();
			});

			// Attributes
			this.widget.on("change", ".loop-filter-custom-attribute", () => {
				this.updateCustomAttributes();
				this.applyFilters();
			});

			// Price
			this.widget
				.find(".loop-price-min-slider, .loop-price-max-slider")
				.on("change", () => {
					this.applyFilters();
				});

			this.widget.find(".loop-price-min-input").on("change", () => {
				const val =
					parseInt(this.widget.find(".loop-price-min-input").val()) ||
					0;
				this.widget.find(".loop-price-min-slider").val(val);
				this.updatePriceDisplay();
				this.applyFilters();
			});

			this.widget.find(".loop-price-max-input").on("change", () => {
				const val =
					parseInt(this.widget.find(".loop-price-max-input").val()) ||
					10000;
				this.widget.find(".loop-price-max-slider").val(val);
				this.updatePriceDisplay();
				this.applyFilters();
			});

			// RESET
			this.widget.find(".loop-filter-reset").on("click", () => {
				this.resetToUniqueProducts();
			});

			// Handle window resize
			let resizeTimer;
			$(window).on("resize", () => {
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(() => {
					this.applyResponsiveLayout();
				}, 250);
			});
		}

		updateCheckboxArray(filterKey, selector) {
			const values = [];
			this.widget.find(selector + ":checked").each(function () {
				values.push(String($(this).val()));
			});
			this.currentFilters[filterKey] = values;
		}

		updateCustomAttributes() {
			const customAttrs = {};
			this.widget
				.find(".loop-filter-custom-attribute:checked")
				.each(function () {
					const value = $(this).val();
					if (value.includes(":")) {
						const [attrName, attrValue] = value.split(":");
						if (!customAttrs[attrName]) {
							customAttrs[attrName] = [];
						}
						customAttrs[attrName].push(attrValue.toLowerCase());
					}
				});
			this.currentFilters.attributes = customAttrs;
		}

		debounce(func, wait) {
			return (...args) => {
				clearTimeout(this.debounceTimer);
				this.debounceTimer = setTimeout(
					() => func.apply(this, args),
					wait,
				);
			};
		}

		applyFilters() {
			console.log("🔍 Applying filters:", this.currentFilters);

			const matchedProducts = [];

			this.uniqueProducts.forEach((product) => {
				if (this.productMatchesFilters(product.data)) {
					matchedProducts.push(product);
				}
			});

			console.log(`✅ Matched ${matchedProducts.length} unique products`);

			// Sort
			if (this.currentFilters.sort !== "date") {
				matchedProducts.sort((a, b) => {
					switch (this.currentFilters.sort) {
						case "title":
							return (a.data.title || "").localeCompare(
								b.data.title || "",
							);
						case "price":
							return (a.data.price || 0) - (b.data.price || 0);
						case "price-desc":
							return (b.data.price || 0) - (a.data.price || 0);
						default:
							return a.index - b.index;
					}
				});
			}

			this.renderProducts(matchedProducts);
		}

		productMatchesFilters(data) {
			// Search
			if (this.currentFilters.search) {
				if (
					!data.title ||
					!data.title.includes(this.currentFilters.search)
				) {
					return false;
				}
			}

			// Categories
			if (this.currentFilters.categories.length > 0) {
				const hasCategory = this.currentFilters.categories.some((cat) =>
					data.categories.includes(cat),
				);
				if (!hasCategory) return false;
			}

			// Tags
			if (this.currentFilters.tags.length > 0) {
				const hasTag = this.currentFilters.tags.some((tag) =>
					data.tags.includes(tag),
				);
				if (!hasTag) return false;
			}

			// Attributes
			for (const [attrName, attrValues] of Object.entries(
				this.currentFilters.attributes,
			)) {
				if (
					!data.attributes[attrName] ||
					data.attributes[attrName].length === 0
				) {
					return false;
				}

				const hasMatch = attrValues.some((filterValue) =>
					data.attributes[attrName].includes(filterValue),
				);

				if (!hasMatch) return false;
			}

			// Price
			if (data.price > 0) {
				if (
					data.price < this.currentFilters.minPrice ||
					data.price > this.currentFilters.maxPrice
				) {
					return false;
				}
			}

			return true;
		}

		renderProducts(products) {
			console.log(`🔨 Rendering ${products.length} UNIQUE products`);

			const container = this.targetGrid[0];
			container.innerHTML = "";

			// Get responsive settings
			const columns = this.getResponsiveColumns();
			const gap = this.getResponsiveGap();
			const deviceType = this.getDeviceType();

			console.log(
				`   Device: ${deviceType}, Columns: ${columns}, Gap: ${gap}`,
			);

			// Apply responsive grid
			this.targetGrid.css({
				display: "grid",
				"grid-template-columns": `repeat(${columns}, 1fr)`,
				gap: gap,
				width: "100%",
				"max-width": "100%",
				"justify-items": "stretch",
				"align-items": "start",
				"justify-content": "start",
				"align-content": "start",
				"box-sizing": "border-box",
			});

			// Track rendered IDs
			const renderedIds = new Set();

			// Add products
			products.forEach((product) => {
				if (renderedIds.has(product.id)) {
					console.warn(
						`⚠️ Prevented duplicate render of product ${product.id}`,
					);
					return;
				}

				const freshClone = product.element.cloneNode(true);
				container.appendChild(freshClone);
				renderedIds.add(product.id);
			});

			console.log(
				`   ✅ Rendered ${renderedIds.size} unique products to DOM`,
			);

			// Animate
			this.animateItems();

			// Show/hide no results
			if (products.length === 0) {
				this.showNoResults();
			} else {
				this.hideNoResults();
			}

			// Reinitialize widgets
			this.reinitializeWidgets();
		}

		applyResponsiveLayout() {
			const columns = this.getResponsiveColumns();
			const gap = this.getResponsiveGap();

			this.targetGrid.css({
				"grid-template-columns": `repeat(${columns}, 1fr)`,
				gap: gap,
			});

			console.log(`📱 Layout updated: ${columns} columns, ${gap} gap`);
		}

		reinitializeWidgets() {
			console.log("🔄 Reinitializing widgets after filter...");

			setTimeout(() => {
				this.reinitializeImageHoverGalleries();
				this.reinitializeOtherWidgets();
				console.log("✅ Widgets reinitialized successfully");
			}, 100);
		}

		reinitializeImageHoverGalleries() {
			const galleries = this.targetGrid.find(".product-hover-gallery");

			if (galleries.length === 0) return;

			console.log(`   🖼️ Found ${galleries.length} image galleries`);

			galleries.each(function () {
				const $gallery = $(this);
				const $wrapper = $gallery.closest(
					".product-hover-gallery-wrapper",
				);
				const images = $gallery.find(".gallery-image");
				const indicators = $wrapper.find(".gallery-indicator");
				const totalImages = images.length;

				if (totalImages <= 1) return;

				let currentIndex = 0;
				let isHovering = false;
				let cycleInterval;
				const autoCycle = $gallery.data("auto-cycle");
				const cycleSpeed = $gallery.data("cycle-speed") || 800;

				function showImage(index) {
					images.removeClass("active");
					indicators.removeClass("active");
					images.eq(index).addClass("active");
					indicators.eq(index).addClass("active");
					currentIndex = index;
				}

				function nextImage() {
					const nextIndex = (currentIndex + 1) % totalImages;
					showImage(nextIndex);
				}

				function startCycle() {
					if (isHovering) {
						if (autoCycle) {
							nextImage();
							cycleInterval = setInterval(nextImage, cycleSpeed);
						} else {
							if (totalImages > 1) {
								showImage(1);
							}
						}
					}
				}

				function stopCycle() {
					if (cycleInterval) {
						clearInterval(cycleInterval);
						cycleInterval = null;
					}
				}

				$wrapper.off("mouseenter mouseleave");
				indicators.off("click");

				$wrapper.on("mouseenter", function () {
					isHovering = true;
					startCycle();
				});

				$wrapper.on("mouseleave", function () {
					isHovering = false;
					stopCycle();
					showImage(0);
				});

				indicators.on("click", function (e) {
					e.preventDefault();
					e.stopPropagation();
					const index = $(this).data("index");
					stopCycle();
					showImage(index);
					if (isHovering && autoCycle) {
						setTimeout(function () {
							cycleInterval = setInterval(nextImage, cycleSpeed);
						}, cycleSpeed);
					}
				});

				console.log(
					`      ✅ Gallery initialized with ${totalImages} images`,
				);
			});
		}

		reinitializeOtherWidgets() {
			const $addToCartButtons = this.targetGrid.find(".ajax_add_to_cart");
			if ($addToCartButtons.length > 0) {
				console.log(
					`   🛒 Found ${$addToCartButtons.length} add to cart buttons`,
				);
			}

			const $badges = this.targetGrid.find(".product-badge");
			if ($badges.length > 0) {
				console.log(`   🏷️ Found ${$badges.length} product badges`);
			}
		}

		animateItems() {
			this.targetGrid
				.find(".e-loop-item, .product-loop-item")
				.css({
					opacity: 0,
					transform: "translateY(20px)",
				})
				.each(function (index) {
					$(this)
						.delay(index * 50)
						.animate({ opacity: 1 }, 300, function () {
							$(this).css("transform", "translateY(0)");
						});
				});
		}

		showNoResults() {
			if (this.targetGrid.find(".no-results-message").length === 0) {
				const msg = $(
					'<div class="no-results-message" style="grid-column: 1/-1; text-align: center; padding: 60px 20px; font-size: 16px; color: #666;">No products found matching your criteria.</div>',
				);
				this.targetGrid.append(msg);
			}
		}

		hideNoResults() {
			this.targetGrid.find(".no-results-message").remove();
		}

		resetToUniqueProducts() {
			console.log("🔄 RESET: Showing all unique products");

			this.widget.find(".loop-filter-search").val("");
			this.widget.find(".loop-filter-sort").val("date");
			this.widget.find('input[type="checkbox"]').prop("checked", false);

			const maxPrice =
				parseInt(
					this.widget.find(".loop-price-max-slider").attr("max"),
				) || 10000;
			this.widget.find(".loop-price-min-slider").val(0);
			this.widget.find(".loop-price-max-slider").val(maxPrice);
			this.updatePriceDisplay();

			this.currentFilters = {
				search: "",
				sort: "date",
				categories: [],
				tags: [],
				attributes: {},
				minPrice: 0,
				maxPrice: maxPrice,
			};

			const allUniqueProducts = Array.from(this.uniqueProducts.values());
			allUniqueProducts.sort((a, b) => a.index - b.index);

			console.log(
				`   📦 Resetting to ${allUniqueProducts.length} unique products`,
			);

			this.renderProducts(allUniqueProducts);

			console.log("✅ Reset complete - showing all unique products");
		}

		setupMobileToggle() {
			console.log("📱 Setting up mobile filter toggle");

			const self = this;
			const sidebar = this.widget.find(".loop-filter-sidebar");
			let toggleBtn = $(".filter-toggle-btn");
			let overlay = $(".filter-overlay");

			// FIXED: Always ensure elements exist
			if (toggleBtn.length === 0) {
				const newToggleBtn = $(
					'<button class="filter-toggle-btn" aria-label="Open Filters">' +
						'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
						'<path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>' +
						"</svg></button>",
				);
				$("body").append(newToggleBtn);
				toggleBtn = $(".filter-toggle-btn");
			}

			if (overlay.length === 0) {
				$("body").append(
					'<div class="filter-overlay" style="display: none;"></div>',
				);
				overlay = $(".filter-overlay");
			}

			// FIXED: Clean up old event listeners
			$(document).off("click.filter-toggle");
			$(document).off("click.filter-close");
			$(document).off("click.filter-overlay");
			this.widget.off("click.filter-sidebar");

			// FIXED: Bind toggle button click with namespace
			$(document).on(
				"click.filter-toggle",
				".filter-toggle-btn",
				function (e) {
					e.preventDefault();
					e.stopPropagation();
					console.log("🔓 Toggle button clicked - Opening filter");
					self.openMobileFilter();
				},
			);

			// FIXED: Bind close button click with namespace
			this.widget.on(
				"click.filter-close",
				".filter-close-btn",
				function (e) {
					e.preventDefault();
					e.stopPropagation();
					console.log("🔐 Close button clicked - Closing filter");
					self.closeMobileFilter();
				},
			);

			// FIXED: Bind overlay click with namespace
			$(document).on(
				"click.filter-overlay",
				".filter-overlay",
				function (e) {
					e.preventDefault();
					e.stopPropagation();
					console.log("🔐 Overlay clicked - Closing filter");
					self.closeMobileFilter();
				},
			);

			// FIXED: Prevent sidebar clicks from closing
			this.widget.on(
				"click.filter-sidebar",
				".loop-filter-sidebar",
				function (e) {
					e.stopPropagation();
				},
			);

			console.log("   ✅ Mobile toggle initialized");
		}

		openMobileFilter() {
			const sidebar = this.widget.find(".loop-filter-sidebar");
			const overlay = $(".filter-overlay");

			console.log("✅ Opening mobile filter");

			// Add active class
			sidebar.addClass("active");
			overlay.addClass("active");

			// Force display
			overlay.stop(true, true).fadeIn(300);

			// Prevent body scroll
			$("body").css("overflow", "hidden");

			console.log("   Sidebar active:", sidebar.hasClass("active"));
			console.log("   Overlay active:", overlay.hasClass("active"));
		}

		closeMobileFilter() {
			const sidebar = this.widget.find(".loop-filter-sidebar");
			const overlay = $(".filter-overlay");

			console.log("✅ Closing mobile filter");

			// Remove active class
			sidebar.removeClass("active");
			overlay.removeClass("active");

			// Animate out
			overlay.stop(true, true).fadeOut(300);

			// Restore body scroll
			$("body").css("overflow", "");

			console.log("   Sidebar active:", sidebar.hasClass("active"));
			console.log("   Overlay active:", overlay.hasClass("active"));
		}
	}

	// Initialize
	$(window).on("elementor/frontend/init", function () {
		if (typeof elementorFrontend !== "undefined") {
			elementorFrontend.hooks.addAction(
				"frontend/element_ready/loop_grid_filter.default",
				function ($scope) {
					const widget = $scope.find(".loop-grid-filter-widget");
					if (widget.length && !widget.data("filter-initialized")) {
						new LoopGridFilter(widget);
						widget.data("filter-initialized", true);
					}
				},
			);
		}
	});

	$(document).ready(function () {
		// Initialize filters on page load
		setTimeout(function () {
			$(".loop-grid-filter-widget").each(function () {
				if (!$(this).data("filter-initialized")) {
					new LoopGridFilter(this);
					$(this).data("filter-initialized", true);
				}
			});
		}, 500);

		// Re-initialize on dynamic content load (AJAX)
		$(document).on("elementor/frontend/init", function () {
			$(".loop-grid-filter-widget").each(function () {
				if (!$(this).data("filter-initialized")) {
					new LoopGridFilter(this);
					$(this).data("filter-initialized", true);
				}
			});
		});
	});

	// Handle window resize for responsive adjustments
	$(window).on("resize", function () {
		$(".loop-grid-filter-widget").each(function () {
			const widget = $(this).data("filter-instance");
			if (widget && widget.applyResponsiveLayout) {
				widget.applyResponsiveLayout();
			}
		});
	});
})(jQuery);
/**
 * MOBILE FILTER TOGGLE - COMPLETE FIX v3
 * Removes inline display:none and uses CSS classes only
 * Add this to the END of your loop-grid-filter.js file
 */

function initMobileFilterToggle() {
	console.log("🎯 Initializing mobile filter toggle - FINAL FIX");

	const $sidebar = $(".filter-sidebar, .loop-filter-sidebar");
	const $toggleBtn = $(".filter-toggle-btn");
	const $overlay = $(".filter-overlay");
	const $closeBtn = $(".filter-close-btn");

	// ===== CRITICAL: REMOVE ALL INLINE STYLES =====
	$sidebar.each(function () {
		// Remove the problematic inline style
		$(this).css({
			display: "",
			visibility: "",
			opacity: "",
			left: "",
			top: "",
			position: "",
			transform: "",
		});
		$(this).removeAttr("style");
		console.log("✅ Removed inline styles from sidebar");
	});

	// ===== ENSURE SIDEBAR IS NOT HIDDEN BY DEFAULT =====
	// The CSS should control this, not inline styles
	$sidebar.removeClass("hidden-by-inline");

	// ===== CLEAN UP OLD EVENT LISTENERS =====
	$(document).off("click.filter-toggle");
	$(document).off("click.filter-close");
	$(document).off("click.filter-overlay");
	$sidebar.off("click.filter-sidebar");

	// ===== OPEN FILTER (Toggle Button Click) =====
	$(document).on("click.filter-toggle", ".filter-toggle-btn", function (e) {
		e.preventDefault();
		e.stopPropagation();

		console.log("📱 Toggle button clicked - Opening filter");

		// Ensure no inline styles block the opening
		$sidebar.removeAttr("style");

		// Add active class (CSS handles the rest)
		$sidebar.addClass("active");
		$overlay.addClass("active");

		// Prevent body scroll
		$("body").css("overflow", "hidden");

		console.log("✅ Sidebar active class added");
	});

	// ===== CLOSE FILTER (Close Button Click) =====
	$(document).on("click.filter-close", ".filter-close-btn", function (e) {
		e.preventDefault();
		e.stopPropagation();

		console.log("🔐 Close button clicked - Closing filter");

		// Remove active class
		$sidebar.removeClass("active");
		$overlay.removeClass("active");

		// Restore body scroll
		$("body").css("overflow", "");

		console.log("✅ Sidebar active class removed");
	});

	// ===== CLOSE FILTER (Overlay Click) =====
	$(document).on("click.filter-overlay", ".filter-overlay", function (e) {
		e.preventDefault();
		e.stopPropagation();

		console.log("📱 Overlay clicked - Closing filter");

		$sidebar.removeClass("active");
		$overlay.removeClass("active");
		$("body").css("overflow", "");
	});

	// ===== PREVENT SIDEBAR CONTENT FROM CLOSING =====
	$(document).on(
		"click.filter-sidebar",
		".filter-sidebar, .loop-filter-sidebar",
		function (e) {
			e.stopPropagation();
		},
	);

	// ===== CLOSE SIDEBAR ON DESKTOP RESIZE =====
	$(window).on("resize", function () {
		if (window.innerWidth > 1024) {
			console.log("📐 Resized to desktop - closing sidebar");
			$sidebar.removeClass("active");
			$overlay.removeClass("active");
			$("body").css("overflow", "");
		}
	});

	console.log("✅ Mobile filter toggle fully initialized - NO INLINE STYLES");
}

// ===== INIT ON DOCUMENT READY =====
$(document).ready(function () {
	setTimeout(initMobileFilterToggle, 500); // Reduced from 1000ms
});

// ===== RE-INIT ON ELEMENTOR FRONTEND =====
$(window).on("elementor/frontend/init", function () {
	setTimeout(initMobileFilterToggle, 1000);
});

// ===== RE-INIT ON AJAX COMPLETE =====
$(document).on("ajaxComplete", function () {
	setTimeout(initMobileFilterToggle, 300);
});

// ===== MUTATION OBSERVER FOR DYNAMIC CONTENT =====
if (typeof MutationObserver !== "undefined") {
	const observer = new MutationObserver(function (mutations) {
		mutations.forEach(function (mutation) {
			// Check if new sidebar was added
			if (
				mutation.type === "childList" &&
				$(mutation.addedNodes).find(
					".filter-sidebar, .loop-filter-sidebar",
				).length
			) {
				console.log("🔄 New sidebar detected - reinitializing");
				setTimeout(initMobileFilterToggle, 300);
			}
		});
	});

	// Start observing
	$(document).ready(function () {
		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	});
}
