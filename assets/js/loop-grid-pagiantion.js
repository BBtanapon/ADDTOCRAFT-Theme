/**
 * Loop Grid Pagination - COMPLETE FIX v3
 * Load More & Infinite Scroll - Both Working
 *
 * @package HelloElementorChild
 */

(function ($) {
	"use strict";

	console.log(
		"%c🚀 Pagination Script Loaded",
		"color: #4CAF50; font-weight: bold; font-size: 16px;",
	);

	// Check if loopGridPaginationData exists
	if (typeof loopGridPaginationData === "undefined") {
		console.error(
			"❌ loopGridPaginationData is not defined! Make sure wp_localize_script is working.",
		);
		return;
	}

	console.log("✅ AJAX URL:", loopGridPaginationData.ajaxUrl);
	console.log("✅ Nonce:", loopGridPaginationData.nonce);

	class LoopGridPagination {
		constructor(wrapper) {
			this.$wrapper = $(wrapper);
			this.widgetId = this.$wrapper.data("widget-id");
			this.paginationType = this.$wrapper.data("pagination-type");
			this.currentPage =
				parseInt(this.$wrapper.data("current-page")) || 1;
			this.maxPages = parseInt(this.$wrapper.data("max-pages")) || 1;

			console.group("🎯 Initializing Pagination");
			console.log("Widget ID:", this.widgetId);
			console.log("Type:", this.paginationType);
			console.log("Current Page:", this.currentPage);
			console.log("Max Pages:", this.maxPages);

			// Decode query args
			try {
				const queryData = this.$wrapper.data("query");
				const settingsData = this.$wrapper.data("settings");

				if (queryData) {
					this.queryArgs = JSON.parse(atob(queryData));
					console.log("✅ Query Args Decoded:", this.queryArgs);
				} else {
					this.queryArgs = {};
					console.warn("⚠️ No query data found");
				}

				if (settingsData) {
					this.settings = JSON.parse(atob(settingsData));
					console.log("✅ Settings Decoded:", this.settings);
				} else {
					this.settings = {};
					console.warn("⚠️ No settings data found");
				}
			} catch (e) {
				console.error("❌ Error decoding data:", e);
				this.queryArgs = {};
				this.settings = {};
			}

			this.$grid = this.$wrapper.find(".custom-product-loop-grid");
			this.isLoading = false;

			console.log("Grid found:", this.$grid.length > 0);
			console.groupEnd();

			this.init();
		}

		init() {
			if (this.paginationType === "none" || this.maxPages <= 1) {
				console.log("⏭️ Pagination disabled or only 1 page");
				return;
			}

			console.log(
				"🔧 Initializing pagination type:",
				this.paginationType,
			);

			switch (this.paginationType) {
				case "load_more":
					this.initLoadMore();
					break;
				case "infinite":
					this.initInfiniteScroll();
					break;
				case "numbers":
					console.log("📄 Page numbers - no JS needed");
					break;
			}
		}

		initLoadMore() {
			console.log("📦 Setting up Load More button...");

			const $btn = this.$wrapper.find(".loop-load-more-btn");

			if ($btn.length === 0) {
				console.error("❌ Load More button not found!");
				console.log(
					"Wrapper HTML:",
					this.$wrapper.html().substring(0, 500),
				);
				return;
			}

			console.log("✅ Load More button found:", $btn);
			console.log("Button HTML:", $btn[0].outerHTML);

			// Remove existing handlers
			$btn.off("click.pagination");

			// Bind click event
			$btn.on("click.pagination", (e) => {
				e.preventDefault();
				e.stopPropagation();

				console.log("🖱️ LOAD MORE CLICKED!");

				if (this.isLoading) {
					console.log("⏳ Already loading...");
					return;
				}

				const nextPage = this.currentPage + 1;

				if (nextPage > this.maxPages) {
					console.log("✅ No more pages");
					$btn.hide();
					this.showNoMoreMessage();
					return;
				}

				console.log(`📄 Loading page ${nextPage}/${this.maxPages}`);
				this.loadMoreProducts(nextPage, $btn);
			});

			console.log("✅ Load More initialized successfully!");
		}

		initInfiniteScroll() {
			console.log("♾️ Setting up Infinite Scroll...");

			const $trigger = this.$wrapper.find(
				".loop-infinite-scroll-trigger",
			);

			if ($trigger.length === 0) {
				console.error("❌ Infinite scroll trigger not found!");
				return;
			}

			console.log("✅ Trigger found:", $trigger);

			const threshold = $trigger.data("threshold") || 300;

			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting && !this.isLoading) {
							const nextPage = this.currentPage + 1;

							if (nextPage > this.maxPages) {
								console.log("✅ All products loaded");
								this.showNoMoreMessage();
								observer.disconnect();
								return;
							}

							console.log(`♾️ Loading page ${nextPage}`);
							this.loadMoreProducts(nextPage, $trigger);
						}
					});
				},
				{
					rootMargin: `${threshold}px`,
				},
			);

			observer.observe($trigger[0]);
			console.log("✅ Infinite scroll observer active!");
		}

		loadMoreProducts(page, $element) {
			console.group(`🔄 Loading Page ${page}`);
			console.log("AJAX URL:", loopGridPaginationData.ajaxUrl);
			console.log("Nonce:", loopGridPaginationData.nonce);
			console.log("Query Args:", this.queryArgs);
			console.log("Settings:", this.settings);

			this.isLoading = true;
			this.showLoadingMessage();

			// Disable button
			if (this.paginationType === "load_more") {
				$element.prop("disabled", true).css("opacity", "0.5");
			}

			const ajaxData = {
				action: "load_more_products",
				nonce: loopGridPaginationData.nonce,
				page: page,
				query_args: JSON.stringify(this.queryArgs),
				settings: JSON.stringify(this.settings),
				widget_id: this.widgetId,
			};

			console.log("Sending AJAX data:", ajaxData);

			$.ajax({
				url: loopGridPaginationData.ajaxUrl,
				type: "POST",
				data: ajaxData,
				success: (response) => {
					console.log("✅ AJAX Response:", response);

					if (response.success && response.data.html) {
						console.log(
							"✅ HTML received, length:",
							response.data.html.length,
						);
						this.appendProducts(response.data.html);
						this.currentPage = page;
						this.$wrapper.data("current-page", page);

						if (page >= this.maxPages) {
							console.log("📊 Reached last page");
							this.showNoMoreMessage();
							if (this.paginationType === "load_more") {
								$element.hide();
							}
						} else {
							if (this.paginationType === "load_more") {
								$element
									.prop("disabled", false)
									.css("opacity", "1");
							}
						}
					} else {
						console.error("❌ Invalid response:", response);
					}
				},
				error: (xhr, status, error) => {
					console.error("❌ AJAX Error:", error);
					console.error("Status:", status);
					console.error("Response Text:", xhr.responseText);
					alert("Error loading products. Check console for details.");

					if (this.paginationType === "load_more") {
						$element.prop("disabled", false).css("opacity", "1");
					}
				},
				complete: () => {
					this.isLoading = false;
					this.hideLoadingMessage();
					console.groupEnd();
				},
			});
		}

		appendProducts(html) {
			console.log("🔨 Appending products...");

			const $newProducts = $(html);
			console.log("New products count:", $newProducts.length);

			// Apply data attributes if needed
			if (window.loopGridProductsData) {
				$newProducts.each((index, item) => {
					const $item = $(item);
					const productId = $item.data("product-id");

					if (productId && window.loopGridProductsData[productId]) {
						const data = window.loopGridProductsData[productId];
						$item.data("product-id", data.id);
						$item.data("title", data.title || "");
						$item.data("price", data.price || "0");
					}
				});
			}

			// Add with animation
			$newProducts.css({
				opacity: 0,
				transform: "translateY(20px)",
			});

			this.$grid.append($newProducts);

			// Animate in
			$newProducts.each(function (index) {
				$(this)
					.delay(index * 50)
					.animate({ opacity: 1 }, 300, function () {
						$(this).css("transform", "translateY(0)");
					});
			});

			console.log("✅ Products appended successfully!");

			// Trigger event
			$(document).trigger("loop-grid-products-loaded", [$newProducts]);
		}

		showLoadingMessage() {
			this.$wrapper.find(".loop-loading-message").fadeIn(200);
		}

		hideLoadingMessage() {
			this.$wrapper.find(".loop-loading-message").fadeOut(200);
		}

		showNoMoreMessage() {
			this.$wrapper.find(".loop-no-more-message").fadeIn(200);
		}
	}

	// Initialize on document ready
	$(document).ready(function () {
		console.log("📦 Document ready - Looking for pagination wrappers...");

		const $wrappers = $(".custom-product-loop-wrapper");
		console.log(`Found ${$wrappers.length} wrapper(s)`);

		if ($wrappers.length === 0) {
			console.warn("⚠️ No pagination wrappers found on page");
			console.log("Page HTML:", $("body").html().substring(0, 1000));
		}

		$wrappers.each(function (index) {
			console.log(`Initializing wrapper ${index + 1}:`, this);
			const $wrapper = $(this);
			const paginationType = $wrapper.data("pagination-type");

			if (paginationType && paginationType !== "none") {
				console.log(
					`🎯 Creating pagination instance for type: ${paginationType}`,
				);
				new LoopGridPagination(this);
			}
		});
	});

	// Initialize on Elementor frontend
	$(window).on("elementor/frontend/init", function () {
		console.log("🎨 Elementor frontend init");

		if (typeof elementorFrontend !== "undefined") {
			elementorFrontend.hooks.addAction(
				"frontend/element_ready/custom_product_loop_grid.default",
				function ($scope) {
					console.log("🔄 Custom product loop grid ready");

					const $wrapper = $scope.find(
						".custom-product-loop-wrapper",
					);
					const paginationType = $wrapper.data("pagination-type");

					if (paginationType && paginationType !== "none") {
						new LoopGridPagination($wrapper[0]);
					}
				},
			);
		}
	});

	// Debug function
	window.debugPagination = function () {
		const $wrapper = $(".custom-product-loop-wrapper").first();

		console.group("📊 Pagination Debug");
		console.log("Wrapper found:", $wrapper.length > 0);
		console.log("Widget ID:", $wrapper.data("widget-id"));
		console.log("Type:", $wrapper.data("pagination-type"));
		console.log("Current Page:", $wrapper.data("current-page"));
		console.log("Max Pages:", $wrapper.data("max-pages"));
		console.log("Button:", $wrapper.find(".loop-load-more-btn"));
		console.log("Grid:", $wrapper.find(".custom-product-loop-grid"));
		console.groupEnd();
	};

	console.log(
		"%c💡 Type debugPagination() to check setup",
		"color: #00BCD4;",
	);
})(jQuery);
