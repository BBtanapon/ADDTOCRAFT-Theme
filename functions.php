<?php
/**
 * Theme functions and definitions - COMPLETE FIXED VERSION
 * All features: Auto Attributes, Filters, Pagination (Load More & Infinite Scroll)
 * FIXED: Load More button click event and AJAX handler
 *
 * @package HelloElementorChild
 */

if (!defined("ABSPATH")) {
	exit();
}

define("HELLO_ELEMENTOR_CHILD_VERSION", "2.1.3");

// =============================================================================
// CORE THEME SETUP
// =============================================================================

/**
 * Enqueue child theme styles
 */
function hello_elementor_child_scripts_styles()
{
	wp_enqueue_style(
		"hello-elementor-child-style",
		get_stylesheet_directory_uri() . "/style.css",
		["hello-elementor-theme-style"],
		HELLO_ELEMENTOR_CHILD_VERSION,
	);
}
add_action("wp_enqueue_scripts", "hello_elementor_child_scripts_styles", 20);

/**
 * Load Dashicons for non-logged-in users
 */
function load_dashicons_for_non_logged_in_users()
{
	if (!is_user_logged_in()) {
		wp_enqueue_style("dashicons");
	}
}
add_action("wp_enqueue_scripts", "load_dashicons_for_non_logged_in_users");

/**
 * Register ACF REST API routes
 */
function register_acf_rest_routes()
{
	register_rest_route("options", "/all", [
		"methods" => "GET",
		"callback" => "acf_options_route",
	]);

	register_rest_route("options", "/all", [
		"methods" => "POST",
		"callback" => "acf_update_route",
	]);
}
add_action("rest_api_init", "register_acf_rest_routes");

/**
 * Get all ACF fields with select field choices
 *
 * @return WP_REST_Response
 */
function acf_options_route()
{
	$fields = get_fields("options");

	if (!$fields) {
		return new WP_REST_Response(["message" => "No fields found"], 404);
	}

	$field_name = "select_product_show_cast";
	$field = acf_get_field($field_name);

	if ($field && isset($field["choices"])) {
		$fields["_choices"][$field_name] = $field["choices"];
	}

	return new WP_REST_Response($fields, 200);
}

/**
 * Update ACF options via REST API
 *
 * @param WP_REST_Request $request The REST request object.
 * @return WP_REST_Response
 */
function acf_update_route(WP_REST_Request $request)
{
	$parameters = $request->get_params();
	$updated_fields = [];
	$errors = [];

	foreach ($parameters as $field_name => $value) {
		if (get_field_object($field_name, "option")) {
			$result = update_field($field_name, $value, "option");

			if ($result) {
				$updated_fields[$field_name] = $value;
			} else {
				$errors[$field_name] = "Failed to update";
			}
		}
	}

	return new WP_REST_Response(
		[
			"message" => "Update operation completed",
			"updated" => $updated_fields,
			"errors" => $errors,
		],
		200,
	);
}

/**
 * Add CORS headers for images
 */
function add_cors_headers_for_images()
{
	if (preg_match('/\.(jpg|jpeg|png|gif|webp)$/i', $_SERVER["REQUEST_URI"])) {
		header("Access-Control-Allow-Origin: *");
		header("Access-Control-Allow-Methods: GET, OPTIONS");
		header(
			"Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept",
		);
	}
}
add_action("init", "add_cors_headers_for_images");

/**
 * Allow users without published posts in REST API
 *
 * @param array           $prepared_args Array of arguments for WP_User_Query.
 * @param WP_REST_Request $request       The REST request object.
 * @return array Modified arguments.
 */
function prefix_remove_has_published_posts_from_wp_api_user_query(
	$prepared_args,
	$request,
) {
	unset($prepared_args["has_published_posts"]);
	return $prepared_args;
}
add_filter(
	"rest_user_query",
	"prefix_remove_has_published_posts_from_wp_api_user_query",
	10,
	2,
);

/**
 * Fix for Elementor blocking ACF in REST API
 *
 * @param WP_REST_Response $response The response object.
 * @param WP_Post          $post     Post object.
 * @param WP_REST_Request  $request  Request object.
 * @return WP_REST_Response Modified response.
 */
function acf_to_rest_api($response, $post, $request)
{
	if (function_exists("get_fields") && isset($post->ID)) {
		$response->data["acf"] = get_fields($post->ID);
	}
	return $response;
}
add_filter("rest_prepare_page", "acf_to_rest_api", 10, 3);

// =============================================================================
// ELEMENTOR CSS - SIMPLIFIED
// =============================================================================

/**
 * Ensure CSS files are generated
 *
 * @param object $css_file The CSS file object.
 */
function ensure_css_file_generated($css_file)
{
	$css_file->update();
}
add_action("elementor/css-file/post/enqueue", "ensure_css_file_generated");

/**
 * Force CSS regeneration on save
 *
 * @param int   $post_id     The post ID.
 * @param array $editor_data The editor data.
 */
function force_css_regeneration($post_id, $editor_data)
{
	if (!class_exists("\Elementor\Core\Files\CSS\Post")) {
		return;
	}

	$css_file = \Elementor\Core\Files\CSS\Post::create($post_id);

	if ($css_file) {
		$css_file->update();
	}
}
add_action("elementor/editor/after_save", "force_css_regeneration", 10, 2);

/**
 * Clear and regenerate all CSS (one-time on theme update)
 */
function maybe_regenerate_all_elementor_css()
{
	if (!get_option("elementor_css_regenerated_v6")) {
		if (class_exists("\Elementor\Plugin")) {
			\Elementor\Plugin::$instance->files_manager->clear_cache();
			update_option("elementor_css_regenerated_v6", true);
		}
	}
}
add_action("init", "maybe_regenerate_all_elementor_css");

// =============================================================================
// AUTO ATTRIBUTES SYSTEM
// =============================================================================

/**
 * Get WooCommerce attributes only
 *
 * @return array Array of WooCommerce attributes.
 */
function get_woocommerce_attributes_only()
{
	if (!class_exists("WooCommerce")) {
		return [];
	}

	global $wpdb;
	$wc_attributes = $wpdb->get_results(
		"SELECT * FROM {$wpdb->prefix}woocommerce_attribute_taxonomies",
	);

	$attributes = [];

	foreach ($wc_attributes as $attribute) {
		$taxonomy = "pa_" . $attribute->attribute_name;

		if (!taxonomy_exists($taxonomy)) {
			continue;
		}

		$terms = get_terms([
			"taxonomy" => $taxonomy,
			"hide_empty" => true,
			"orderby" => "name",
			"order" => "ASC",
		]);

		if (empty($terms) || is_wp_error($terms)) {
			continue;
		}

		$attributes[$taxonomy] = [
			"name" => $attribute->attribute_name,
			"label" => $attribute->attribute_label,
			"taxonomy" => $taxonomy,
			"terms" => $terms,
		];
	}

	return $attributes;
}

/**
 * Get all product attributes
 *
 * @param WC_Product $product The product object.
 * @return array Array of product attributes.
 */
function get_all_product_attributes($product)
{
	if (!$product) {
		return [];
	}

	$attributes_data = [
		"id" => $product->get_id(),
		"title" => $product->get_name(),
		"price" => 0,
		"regular_price" => 0,
		"sale_price" => 0,
		"on_sale" => $product->is_on_sale(),
		"min_price" => 0,
		"max_price" => 0,
		"categories" => [],
		"tags" => [],
		"attributes" => [],
	];

	// Handle variable products
	if ($product->is_type("variable")) {
		$variation_prices = $product->get_variation_prices(true);

		if (!empty($variation_prices["price"])) {
			$attributes_data["min_price"] = min($variation_prices["price"]);
			$attributes_data["max_price"] = max($variation_prices["price"]);
			$attributes_data["price"] = $attributes_data["min_price"];
		}

		if (!empty($variation_prices["regular_price"])) {
			$attributes_data["regular_price"] = min(
				$variation_prices["regular_price"],
			);
		}

		if (!empty($variation_prices["sale_price"]) && $product->is_on_sale()) {
			$attributes_data["sale_price"] = min(
				$variation_prices["sale_price"],
			);
		}
	} else {
		// Handle simple products
		$attributes_data[
			"regular_price"
		] = (float) $product->get_regular_price();
		$attributes_data["sale_price"] = (float) $product->get_sale_price();

		if ($product->is_on_sale() && $attributes_data["sale_price"] > 0) {
			$attributes_data["price"] = $attributes_data["sale_price"];
		} else {
			$attributes_data["price"] = $attributes_data["regular_price"];
		}
	}

	// Get categories
	$categories = get_the_terms($product->get_id(), "product_cat");
	if ($categories && !is_wp_error($categories)) {
		$attributes_data["categories"] = wp_list_pluck($categories, "term_id");
	}

	// Get tags
	$tags = get_the_terms($product->get_id(), "product_tag");
	if ($tags && !is_wp_error($tags)) {
		$attributes_data["tags"] = wp_list_pluck($tags, "term_id");
	}

	// Get product attributes
	$product_attributes = $product->get_attributes();

	foreach ($product_attributes as $attribute) {
		if (!$attribute->is_taxonomy()) {
			continue;
		}

		$taxonomy = $attribute->get_name();

		if (strpos($taxonomy, "pa_") !== 0) {
			continue;
		}

		$terms = wc_get_product_terms($product->get_id(), $taxonomy, [
			"fields" => "all",
		]);

		if (!empty($terms) && !is_wp_error($terms)) {
			$attributes_data["attributes"][$taxonomy] = wp_list_pluck(
				$terms,
				"slug",
			);
		}
	}

	return $attributes_data;
}

/**
 * AJAX handler for loading more products
 */
function ajax_load_more_products()
{
	error_log("🔵 AJAX Load More Products Called");
	error_log("POST data: " . print_r($_POST, true));

	// Verify nonce
	if (
		!isset($_POST["nonce"]) ||
		!wp_verify_nonce($_POST["nonce"], "loop_grid_pagination")
	) {
		error_log("❌ Nonce verification failed");
		wp_send_json_error(["message" => "Invalid security token"]);
		return;
	}

	// Get and validate parameters
	$page = isset($_POST["page"]) ? absint($_POST["page"]) : 1;
	$widget_id = isset($_POST["widget_id"])
		? sanitize_text_field($_POST["widget_id"])
		: "";
	$post_id = isset($_POST["post_id"]) ? absint($_POST["post_id"]) : 0;
	$element_id = isset($_POST["element_id"])
		? sanitize_text_field($_POST["element_id"])
		: "";
	$posts_per_page = isset($_POST["posts_per_page"])
		? absint($_POST["posts_per_page"])
		: 12;

	error_log(
		"Page: {$page}, Widget: {$widget_id}, Post: {$post_id}, Element: {$element_id}",
	);

	// Get widget settings
	$elementor = \Elementor\Plugin::instance();
	$document = $elementor->documents->get($post_id);

	if (!$document) {
		error_log("❌ Document not found");
		wp_send_json_error(["message" => "Document not found"]);
		return;
	}

	$elements = $document->get_elements_data();
	$settings = null;

	// Find widget settings recursively
	array_walk_recursive(
		$elements,
		function ($value, $key) use ($element_id, &$settings) {
			if ($key === "id" && $value === $element_id) {
				$settings = func_get_arg(2);
			}
		},
		$settings,
	);

	if (!$settings) {
		error_log("❌ Widget settings not found");
		wp_send_json_error(["message" => "Widget settings not found"]);
		return;
	}

	error_log("Widget settings found");

	// Get active filters
	$active_filters = isset($_POST["filters"])
		? json_decode(stripslashes($_POST["filters"]), true)
		: [];
	error_log("Active filters: " . print_r($active_filters, true));

	// Build query arguments
	$args = [
		"post_type" => "product",
		"post_status" => "publish",
		"posts_per_page" => $posts_per_page,
		"paged" => $page,
		"orderby" => isset($settings["orderby"])
			? $settings["orderby"]
			: "date",
		"order" => isset($settings["order"]) ? $settings["order"] : "DESC",
	];

	// Apply filters
	if (!empty($active_filters)) {
		$tax_query = ["relation" => "AND"];

		foreach ($active_filters as $taxonomy => $term_ids) {
			if (!empty($term_ids)) {
				$tax_query[] = [
					"taxonomy" => $taxonomy,
					"field" => "term_id",
					"terms" => array_map("intval", $term_ids),
					"operator" => "IN",
				];
			}
		}

		if (count($tax_query) > 1) {
			$args["tax_query"] = $tax_query;
		}
	}

	error_log("Query args: " . print_r($args, true));

	// Execute query
	$products_query = new WP_Query($args);
	error_log(
		"Found {$products_query->found_posts} products, Max pages: {$products_query->max_num_pages}",
	);

	if (!$products_query->have_posts()) {
		error_log("❌ No products found");
		wp_send_json_error(["message" => "No more products found"]);
		return;
	}

	// Generate HTML
	ob_start();

	$rendered_count = 0;

	while ($products_query->have_posts()) {

		$products_query->the_post();
		$rendered_count++;

		$product_id = get_the_ID();
		$product = wc_get_product($product_id);

		if (!$product) {
			continue;
		}

		// Prepare product data attributes
		$product_data = [
			"id" => $product_id,
			"title" => get_the_title(),
			"price" => $product->get_price(),
		];

		// Add price data
		if ($product->is_type("variable")) {
			$variation_prices = $product->get_variation_prices(true);

			if (!empty($variation_prices["price"])) {
				$product_data["min-price"] = min($variation_prices["price"]);
				$product_data["max-price"] = max($variation_prices["price"]);
			}
		}

		// Add categories
		$categories = get_the_terms($product_id, "product_cat");
		if ($categories && !is_wp_error($categories)) {
			$product_data["product_cat"] = implode(
				",",
				wp_list_pluck($categories, "term_id"),
			);
		}

		// Add tags
		$tags = get_the_terms($product_id, "product_tag");
		if ($tags && !is_wp_error($tags)) {
			$product_data["product_tag"] = implode(
				",",
				wp_list_pluck($tags, "term_id"),
			);
		}

		// Add attributes
		$product_attributes = $product->get_attributes();

		foreach ($product_attributes as $attribute) {
			if (!$attribute->is_taxonomy()) {
				continue;
			}

			$taxonomy = $attribute->get_name();

			if (strpos($taxonomy, "pa_") !== 0) {
				continue;
			}

			$terms = wc_get_product_terms($product_id, $taxonomy, [
				"fields" => "slugs",
			]);

			if (!empty($terms) && !is_wp_error($terms)) {
				$product_data[$taxonomy] = implode(",", $terms);
			}
		}

		// Render data attributes
		$data_attrs = "";
		foreach ($product_data as $key => $value) {
			$data_attrs .= sprintf(
				' data-%s="%s"',
				esc_attr($key),
				esc_attr($value),
			);
		}
		?>
		<article class="e-loop-item product-loop-item product-id-<?php echo esc_attr(
  	$product_id,
  ); ?>" <?php echo $data_attrs; ?>>
			<?php // Check if using custom template
   if (
   	!empty($settings["use_custom_template"]) &&
   	$settings["use_custom_template"] === "yes" &&
   	!empty($settings["template_id"])
   ) {
   	error_log("Using custom template: " . $settings["template_id"]);
   	echo \Elementor\Plugin::instance()->frontend->get_builder_content(
   		$settings["template_id"],
   		true,
   	);
   } else {
   	error_log("Using default product card");
   	render_default_product_card_for_ajax($product);
   } ?>
		</article>
		<?php
	}

	wp_reset_postdata();

	$html = ob_get_clean();

	error_log("✅ Rendered {$rendered_count} products");
	error_log("HTML length: " . strlen($html));

	if (empty($html)) {
		error_log("❌ Generated HTML is empty!");
		wp_send_json_error([
			"message" => "Failed to generate HTML",
			"debug" => "HTML output is empty",
		]);
		return;
	}

	error_log("🎉 Success! Sending response...");

	wp_send_json_success([
		"html" => $html,
		"page" => $page,
		"max_pages" => $products_query->max_num_pages,
		"found_posts" => $products_query->found_posts,
		"rendered_count" => $rendered_count,
	]);
}
add_action("wp_ajax_load_more_products", "ajax_load_more_products");
add_action("wp_ajax_nopriv_load_more_products", "ajax_load_more_products");

/**
 * Render default product card for AJAX
 *
 * @param WC_Product $product The product object.
 */
function render_default_product_card_for_ajax($product)
{
	$is_on_sale = $product->is_on_sale();
	$tags = get_the_terms($product->get_id(), "product_tag");
	$main_tag = $tags && !is_wp_error($tags) ? $tags[0]->name : "";
	?>
	<div class="default-product-card">
		<div class="product-badges">
			<?php if ($is_on_sale): ?>
				<span class="badge-sale"><?php esc_html_e(
    	"Sale!",
    	"hello-elementor-child",
    ); ?></span>
			<?php endif; ?>
			<?php if ($main_tag): ?>
				<span class="badge-tag"><?php echo esc_html($main_tag); ?></span>
			<?php endif; ?>
		</div>

		<a href="<?php echo esc_url(get_permalink()); ?>" class="product-image-link">
			<?php echo $product->get_image("woocommerce_thumbnail"); ?>
		</a>

		<div class="product-info">
			<h3 class="product-title">
				<a href="<?php echo esc_url(get_permalink()); ?>">
					<?php echo esc_html($product->get_name()); ?>
				</a>
			</h3>

			<div class="product-price">
				<?php echo $product->get_price_html(); ?>
			</div>

			<div class="product-actions">
				<?php if ($product->is_type("variable")): ?>
					<a href="<?php echo esc_url(get_permalink()); ?>" class="btn-select-options">
						<?php esc_html_e("SELECT OPTIONS", "hello-elementor-child"); ?>
					</a>
				<?php else: ?>
					<?php woocommerce_template_loop_add_to_cart(); ?>
				<?php endif; ?>
			</div>
		</div>
	</div>
	<?php
}

// =============================================================================
// WOOCOMMERCE AJAX ADD TO CART
// =============================================================================

/**
 * AJAX add to cart handler
 */
function woocommerce_ajax_add_to_cart()
{
	$product_id = apply_filters(
		"woocommerce_add_to_cart_product_id",
		absint($_POST["product_id"]),
	);

	$quantity = empty($_POST["quantity"])
		? 1
		: wc_stock_amount($_POST["quantity"]);

	$variation_id = isset($_POST["variation_id"])
		? absint($_POST["variation_id"])
		: 0;

	$passed_validation = apply_filters(
		"woocommerce_add_to_cart_validation",
		true,
		$product_id,
		$quantity,
	);

	$product_status = get_post_status($product_id);

	if (
		$passed_validation &&
		WC()->cart->add_to_cart($product_id, $quantity, $variation_id) &&
		"publish" === $product_status
	) {
		do_action("woocommerce_ajax_added_to_cart", $product_id);

		if ("yes" === get_option("woocommerce_cart_redirect_after_add")) {
			wc_add_to_cart_message([$product_id => $quantity], true);
		}

		WC_AJAX::get_refreshed_fragments();
	} else {
		$data = [
			"error" => true,
			"product_url" => apply_filters(
				"woocommerce_cart_redirect_after_error",
				get_permalink($product_id),
				$product_id,
			),
		];

		echo wp_send_json($data);
	}

	wp_die();
}
add_action(
	"wp_ajax_woocommerce_ajax_add_to_cart",
	"woocommerce_ajax_add_to_cart",
);
add_action(
	"wp_ajax_nopriv_woocommerce_ajax_add_to_cart",
	"woocommerce_ajax_add_to_cart",
);

// =============================================================================
// ELEMENTOR WIDGETS
// =============================================================================

/**
 * Add custom Elementor widget categories
 *
 * @param object $elements_manager The elements manager instance.
 */
function add_elementor_widget_categories($elements_manager)
{
	$elements_manager->add_category("custom-widgets", [
		"title" => __("Custom Widgets", "hello-elementor-child"),
		"icon" => "fa fa-plug",
	]);
}
add_action(
	"elementor/elements/categories_registered",
	"add_elementor_widget_categories",
);

/**
 * Register custom Elementor widgets
 *
 * @param object $widgets_manager The widgets manager instance.
 */
function register_custom_elementor_widgets($widgets_manager)
{
	$widget_files = [
		"login-logout-widget.php",
		"product-image-hover-widget.php",
		"product-badge-widget.php",
		"loop-grid-filter-widget.php",
		"product-add-to-cart.php",
		"custom-product-loop-grid.php",
	];

	foreach ($widget_files as $file) {
		$file_path = get_stylesheet_directory() . "/elementor-widgets/" . $file;

		if (file_exists($file_path)) {
			require_once $file_path;
		}
	}

	// Register widgets
	if (class_exists("Elementor_Login_Logout_Widget")) {
		$widgets_manager->register(new \Elementor_Login_Logout_Widget());
	}

	if (class_exists("Elementor_Product_Image_Hover_Widget")) {
		$widgets_manager->register(new \Elementor_Product_Image_Hover_Widget());
	}

	if (class_exists("Elementor_Product_Badge_Widget")) {
		$widgets_manager->register(new \Elementor_Product_Badge_Widget());
	}

	if (class_exists("Elementor_Loop_Grid_Filter_Widget")) {
		$widgets_manager->register(new \Elementor_Loop_Grid_Filter_Widget());
	}

	if (class_exists("Elementor_Product_Add_To_Cart")) {
		$widgets_manager->register(new \Elementor_Product_Add_To_Cart());
	}

	if (class_exists("Elementor_Custom_Product_Loop_Grid")) {
		$widgets_manager->register(new \Elementor_Custom_Product_Loop_Grid());
	}
}
add_action("elementor/widgets/register", "register_custom_elementor_widgets");

/**
 * Create Elementor widgets directory
 */
function create_elementor_widgets_directory()
{
	$widgets_dir = get_stylesheet_directory() . "/elementor-widgets";

	if (!file_exists($widgets_dir)) {
		wp_mkdir_p($widgets_dir);
	}
}
add_action("init", "create_elementor_widgets_directory");

// =============================================================================
// CUSTOM LOOP QUERIES
// =============================================================================

$loop_queries_file =
	get_stylesheet_directory() . "/includes/class-elementor-loop-queries.php";

if (file_exists($loop_queries_file)) {
	require_once $loop_queries_file;
	new Custom_Elementor_Loop_Query_Sources();
}

// =============================================================================
// DEBUG FUNCTIONS (Remove in production)
// =============================================================================

/**
 * Test AJAX handler
 */
function test_ajax_handler()
{
	wp_send_json_success(["message" => "AJAX is working!"]);
}
add_action("wp_ajax_test_ajax", "test_ajax_handler");
add_action("wp_ajax_nopriv_test_ajax", "test_ajax_handler");

/**
 * Debug: Output current pagination setup (admin only)
 */
function debug_pagination_setup()
{
	if (!current_user_can("manage_options")) {
		return;
	} ?>
	<script>
	console.log('%c🔧 Debug Mode Active', 'color: #FF9800; font-weight: bold;');
	console.log('Pagination Data:', typeof loopGridPaginationData !== 'undefined' ? loopGridPaginationData : 'NOT LOADED');
	console.log('jQuery loaded:', typeof jQuery !== 'undefined');
	console.log('Elementor loaded:', typeof elementorFrontend !== 'undefined');
	</script>
	<?php
}
add_action("wp_footer", "debug_pagination_setup", 999);
// ลบ Site Icon ของ WordPress
remove_action("wp_head", "wp_site_icon", 99);

function add_favicon_with_acf_fallback()
{
	$favicon_image = "";

	// ACF favicon
	$acf_favicon = get_field("1_0_favicon_image", "option");
	if ($acf_favicon) {
		if (is_numeric($acf_favicon)) {
			$image = wp_get_attachment_image_src($acf_favicon, [512, 512]);
			if ($image) {
				$favicon_image = $image[0];
			}
		} elseif (is_array($acf_favicon) && isset($acf_favicon["ID"])) {
			$image = wp_get_attachment_image_src($acf_favicon["ID"], [
				512,
				512,
			]);
			if ($image) {
				$favicon_image = $image[0];
			}
		} elseif (is_array($acf_favicon) && isset($acf_favicon["url"])) {
			$favicon_image = $acf_favicon["url"];
		} elseif (is_string($acf_favicon)) {
			$favicon_image = $acf_favicon;
		}
	}

	if ($favicon_image) {
		echo '<link rel="icon" href="' .
			esc_url($favicon_image) .
			'" sizes="512x512" />';
	} else {
		// ถ้าไม่มี ACF favicon ให้ WordPress Site Icon ทำงานตามปกติ
		if (function_exists("wp_site_icon")) {
			wp_site_icon();
		}
	}
}
add_action("wp_head", "add_favicon_with_acf_fallback", 1);
