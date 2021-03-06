// vim: ts=2:sw=2:sts=2:
// CS 174a Project 3 Ray Tracer Skeleton

var mult_3_coeffs = function( a, b ) { return [ a[0]*b[0], a[1]*b[1], a[2]*b[2] ]; };       // Convenient way to combine two color-reducing vectors

Declare_Any_Class( "Ball", // The following data members of a ball are filled in for you in Ray_Tracer::parse_line():
  { 'construct'( position, size, color, k_a, k_d, k_s, n, k_r, k_refract, refract_index )
      { this.define_data_members( { position, size, color, k_a, k_d, k_s, n, k_r, k_refract, refract_index } );
 
        this.model_transform = mult(translation(position), scale(size));
        this.world_to_object = inverse(this.model_transform);
        this.normal_to_world = transpose(this.world_to_object);
      },
    'intersect'( ray, existing_intersection, minimum_dist )
      {
        // TODO:
        // Given a ray, check if this Ball is in its path.  Recieves as an argument a record of the nearest intersection found so far (a Ball pointer, a t distance
        // value along the ray, and a normal), updates it if needed, and returns it.  Only counts intersections that are at least a given distance ahead along the ray.

        // TIP:  Once intersect() is done, call it in trace() as you loop through all the spheres until you've found the ray's nearest available intersection.  Simply
        // return a dummy color if the intersection tests positive.  This will show the spheres' outlines, giving early proof that you did intersect() correctly.

        // ray being a unit vector should make things easier

        // ray equation: x = s + td
        // t: parameter
        // d: direction of ray
        // s: source (origin) of the ray
        // x: points on the ray

        // sphere equation: ||x - c||^2 = r^2
        // c: center of sphere (0,0,0)
        // r: radius of sphere (1)
        // x: points on surface of sphere
  
        let s = mult_vec(this.world_to_object, ray.origin);
        let d = normalize(mult_vec(this.world_to_object, ray.dir));

        s.pop();
        d.pop();

        let s_dot_d = dot(s, d);
        let disc = s_dot_d**2 - dot(s, s) + 1;

        if (disc > 0) { // two solutions
          let t0 = -s_dot_d - Math.sqrt(disc);
          let t1 = -s_dot_d + Math.sqrt(disc);

          // object coordinate calculations
          let t = Math.min(t0, t1);
          let inside_sphere = false;

          // check if inside a sphere
          if (t0 < minimum_dist && minimum_dist < t1) {
            inside_sphere = true;
            t = Math.max(t0, t1);
          }

          // calculate hit & normal in object coordinates
          let hit = add(s, scale_vec(t, d)).concat(1); // hit is a point
          let n = add(s, scale_vec(t, d)).concat(0);   // n is a vector

          // transform to world coordinates
          hit = mult_vec(this.model_transform, hit);
          let t_world = length(subtract(hit, ray.origin));

          if (minimum_dist < t && t < existing_intersection.distance) {
            n = mult_vec(this.normal_to_world, n);

            if (inside_sphere) {
              n = negate(n);
            }

            hit.pop();
            n.pop();
            return { distance: t, point: hit, ball: this, normal: normalize(n) };
          }
        }

        return existing_intersection;
      }
  } );

Declare_Any_Class( "Ray_Tracer",
  { 'construct'( context )
      { this.define_data_members( { width: 32, height: 32, near: 1, left: -1, right: 1, bottom: -1, top: 1, ambient: [.1, .1, .1],
                                    balls: [], lights: [], curr_background_function: "color", background_color: [0, 0, 0, 1 ],
                                    scanline: 0, visible: true, scratchpad: document.createElement('canvas'), gl: context.gl,
                                    shader: context.shaders_in_use["Phong_Model"] } );
        var shapes = { "square": new Square(),                  // For texturing with and showing the ray traced result
                       "sphere": new Subdivision_Sphere( 4 ) };   // For drawing with ray tracing turned off
        this.submit_shapes( context, shapes );

        this.texture = new Texture ( context.gl, "", false, false );           // Initial image source: Blank gif file
        this.texture.image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        context.textures_in_use[ "procedural" ]  =  this.texture;

        this.scratchpad.width = this.width;  this.scratchpad.height = this.height;
        this.imageData          = new ImageData( this.width, this.height );     // Will hold ray traced pixels waiting to be stored in the texture
        this.scratchpad_context = this.scratchpad.getContext('2d');             // A hidden canvas for assembling the texture

        this.background_functions =                 // These convert a ray into a color even when no balls were struck by the ray.
          { waves: function( ray )
            { return Color( .5*Math.pow( Math.sin( 2*ray.dir[0] ), 4 ) + Math.abs( .5*Math.cos( 8*ray.dir[0] + Math.sin( 10*ray.dir[1] ) + Math.sin( 10*ray.dir[2] ) ) ),
                            .5*Math.pow( Math.sin( 2*ray.dir[1] ), 4 ) + Math.abs( .5*Math.cos( 8*ray.dir[1] + Math.sin( 10*ray.dir[0] ) + Math.sin( 10*ray.dir[2] ) ) ),
                            .5*Math.pow( Math.sin( 2*ray.dir[2] ), 4 ) + Math.abs( .5*Math.cos( 8*ray.dir[2] + Math.sin( 10*ray.dir[1] ) + Math.sin( 10*ray.dir[0] ) ) ), 1 );
            },
            lasers: function( ray ) 
            { var u = Math.acos( ray.dir[0] ), v = Math.atan2( ray.dir[1], ray.dir[2] );
              return Color( 1 + .5 * Math.cos( 20 * ~~u  ), 1 + .5 * Math.cos( 20 * ~~v ), 1 + .5 * Math.cos( 8 * ~~u ), 1 );
            },
            mixture:     ( function( ray ) { return mult_3_coeffs( this.background_functions["waves" ]( ray ), 
                                                                   this.background_functions["lasers"]( ray ) ).concat(1); } ).bind( this ),
            ray_direction: function( ray ) { return Color( Math.abs( ray.dir[ 0 ] ), Math.abs( ray.dir[ 1 ] ), Math.abs( ray.dir[ 2 ] ), 1 );  },
            color:       ( function( ray ) { return this.background_color;  } ).bind( this )
          };       
        this.make_menu();
        this.load_case( "show_homework_spec" );
      },
    'get_dir'( ix, iy )   
      {
        // Map an (x,y) pixel to a corresponding xyz vector that reaches the near plane.  If correct, everything under the "background effects" menu will now work. 
        let a = ix / this.width;
        let x = a * this.right + (1-a) * this.left;

        let b = iy / this.height;
        let y = b * this.top + (1-b) * this.bottom;

        return vec4(x, y, -this.near, 0);
      },
    'color_missed_ray'( ray ) { return mult_3_coeffs( this.ambient, this.background_functions[ this.curr_background_function ] ( ray ) ).concat(1); },
    'trace'( ray, color_remaining, is_primary, light_to_check=null )
      {
    // TODO:  Given a ray, return the color in that ray's path.  The ray either originates from the camera itself or from a secondary reflection or refraction off of a
    //        ball.  Call Ball.prototype.intersect on each ball to determine the nearest ball struck, if any, and perform vector math (the Phong reflection formula)
    //        using the resulting intersection record to figure out the influence of light on that spot.  Recurse for reflections and refractions until the final color
    //        is no longer significantly affected by more bounces.
    //
    //        Arguments besides the ray include color_remaining, the proportion of brightness this ray can contribute to the final pixel.  Only if that's still
    //        significant, proceed with the current recursion, computing the Phong model's brightness of each color.  When recursing, scale color_remaining down by k_r
    //        or k_refract, multiplied by the "complement" (1-alpha) of the Phong color this recursion.  Use argument is_primary to indicate whether this is the original
    //        ray or a recursion.  Use the argument light_to_check when a recursive call to trace() is for computing a shadow ray.
        
        if (length( color_remaining ) < .3) {
          return Color( 0, 0, 0, 1 );  // Each recursion, check if there's any remaining potential for the pixel to be brightened.
        }

        let min_dist = this.near;
        if (!is_primary) {
          min_dist = 0.00001;
        }

        let closest_intersect = {
          distance: Number.POSITIVE_INFINITY,
          point: null,
          ball: null,
          normal: null
        };   // An empty intersection object
        
        for (let i = 0; i < this.balls.length; i++) {
          closest_intersect = this.balls[i].intersect(ray, closest_intersect, min_dist);

          // if shadow ray, check for intersect between ray and light
          if (light_to_check && closest_intersect.ball) {
            if (0 < closest_intersect.distance) {
              return true;
            }
          }
        }

        if (light_to_check) {
          return false;
        }

        if (closest_intersect.ball) {
          //return Color(1, 0, 0, 1);
          let ball = closest_intersect.ball;
          let hit = closest_intersect.point;
          let N = closest_intersect.normal;
          let V = normalize(negate(ray.dir)).slice(0,3);
          let surface_color = scale_vec(ball.k_a, ball.color); // ambient contribution

          for (let i = 0; i < this.lights.length; i++) {
            let L = normalize(subtract(this.lights[i].position.slice(0,3), hit));
            let L_dot_N = dot(L, N);
            let R = normalize(subtract(scale_vec(2 * L_dot_N, N), L));
            let H = normalize(add(L, V));

            // shadow
            let shadow_ray = {
              origin: hit.concat(1),
              dir: subtract(this.lights[i].position.slice(0,3), hit).concat(0)
              //dir: L.concat(0)
            };

            if (this.trace(shadow_ray, color_remaining, false, light_to_check=this.lights[i])) {
              continue;
            }

            let diffuse_light_contribution = scale_vec(
              ball.k_d * Math.max(0, L_dot_N),
              ball.color
            );

            let specular_light_contribution = scale_vec(
              ball.k_s * Math.pow(Math.max(0, dot(R, V)), ball.n),
              vec3(1,1,1)
            );

            surface_color = add(
              surface_color,
              mult(
                this.lights[i].color.slice(0,3),
                add(specular_light_contribution, diffuse_light_contribution)
              )
            );
          }

          // restrict surface_color values to at most 1
          //for (let i = 0; i < surface_color.length; i++) {
          //  surface_color[i] = Math.min(1, surface_color[i]);
          //}

          // reflect
          let k_r = closest_intersect.ball.k_r;
          let color_next_r = scale_vec(
            k_r,
            mult_3_coeffs(
              color_remaining,
              subtract(vec3(1,1,1), surface_color)
            )
          );

          let reflect_ray = {
            origin: hit.concat(1),
            dir: subtract(scale_vec(2 * dot(V, N), N), V).concat(0)
          };

          let pixel_color = add(
            surface_color,
            mult_3_coeffs(
              subtract(vec3(1,1,1), surface_color),
              scale_vec(
                k_r,
                this.trace(reflect_ray, color_next_r, false).slice(0,3)
              )
            )
          );

          // refract
          /*
          let k_refract = closest_intersect.ball.k_refract;
          let color_next_refract = scale_vec(
            k_refract,
            mult_3_coeffs(
              color_remaining,
              subtract(vec3(1,1,1), surface_color)
            )
          );
          */

          /*
          let l = negate(V);
          let r = 1/ball.refract_index;
          let c = -dot(N, l);
          let refract_ray = {
            origin: hit.concat(1),
            dir: add(
              scale_vec(r, l),
              scale_vec(r*c - Math.sqrt(1 - r**2 * (1 - c**2)), N)
            )
          };

          pixel_color = add(
            pixel_color,
            scale_vec(
              k_refract,
              this.trace(refract_ray, color_next_refract, false).slice(0,3)
            )
          );*/

          //return surface_color;
          return pixel_color;
          //return reflect_ray.dir;
          //return N;

          /* 
           * vec3 pixel_color = surface_color + (white - surface_color) *
           *                    (k_r * trace(...).slice(0,3) + k_refract * trace(...).slice(0,3))
           */
        }

        return this.color_missed_ray(ray);
      },
    'parse_line'( tokens )            // Load the lines from the textbox into variables
      { for( let i = 1; i < tokens.length; i++ ) tokens[i] = Number.parseFloat( tokens[i] );
        switch( tokens[0] )
          { case "NEAR":    this.near   = tokens[1];  break;
            case "LEFT":    this.left   = tokens[1];  break;
            case "RIGHT":   this.right  = tokens[1];  break;
            case "BOTTOM":  this.bottom = tokens[1];  break;
            case "TOP":     this.top    = tokens[1];  break;
            case "RES":     this.width             = tokens[1];   this.height            = tokens[2]; 
                            this.scratchpad.width  = this.width;  this.scratchpad.height = this.height; break;
            case "SPHERE":
              this.balls.push( new Ball( [tokens[1], tokens[2], tokens[3]], [tokens[4], tokens[5], tokens[6]], [tokens[7],tokens[8],tokens[9]], 
                                          tokens[10],tokens[11],tokens[12],  tokens[13],tokens[14],tokens[15],  tokens[16] ) ); break;
            case "LIGHT":   this.lights.push( new Light( [ tokens[1],tokens[2],tokens[3], 1 ], Color( tokens[4],tokens[5],tokens[6], 1 ),    10000000 ) ); break;
            case "BACK":    this.background_color = Color( tokens[1],tokens[2],tokens[3], 1 ); this.gl.clearColor.apply( this.gl, this.background_color ); break;
            case "AMBIENT": this.ambient = [tokens[1], tokens[2], tokens[3]];          
          }
      },
    'parse_file'()        // Move through the text lines
      { this.balls = [];   this.lights = [];
        this.scanline = 0; this.scanlines_per_frame = 1;                            // Begin at bottom scanline, forget the last image's speedup factor
        document.getElementById("progress").style = "display:inline-block;";        // Re-show progress bar
        this.camera_needs_reset = true;                                             // Reset camera
        var input_lines = document.getElementById( "input_scene" ).value.split("\n");
        for( let i of input_lines ) this.parse_line( i.split(/\s+/) );
      },
    'load_case'( i ) {   document.getElementById( "input_scene" ).value = test_cases[ i ];   },
    'make_menu'()
      { document.getElementById( "raytracer_menu" ).innerHTML = "<span style='white-space: nowrap'> \
          <button id='toggle_raytracing' class='dropbtn' style='background-color: #AF4C50'>Toggle Ray Tracing</button> \
          <button onclick='document.getElementById(\"myDropdown2\").classList.toggle(\"show\"); return false;' class='dropbtn' style='background-color: #8A8A4C'> \
          Select Background Effect</button><div  id='myDropdown2' class='dropdown-content'>  </div>\
          <button onclick='document.getElementById(\"myDropdown\" ).classList.toggle(\"show\"); return false;' class='dropbtn' style='background-color: #4C50AF'> \
          Select Test Case</button        ><div  id='myDropdown' class='dropdown-content'>  </div> \
          <button id='submit_scene' class='dropbtn'>Submit Scene Textbox</button> \
          <div id='progress' style = 'display:none;' ></div></span>";
        for( let i in test_cases )
          { var a = document.createElement( "a" );
            a.addEventListener("click", function() { this.load_case( i ); this.parse_file(); }.bind( this    ), false);
            a.innerHTML = i;
            document.getElementById( "myDropdown"  ).appendChild( a );
          }
        for( let j in this.background_functions )
          { var a = document.createElement( "a" );
            a.addEventListener("click", function() { this.curr_background_function = j;      }.bind( this, j ), false);
            a.innerHTML = j;
            document.getElementById( "myDropdown2" ).appendChild( a );
          }
        
        document.getElementById( "input_scene" ).addEventListener( "keydown", function(event) { event.cancelBubble = true; }, false );
        
        window.addEventListener( "click", function(event) {  if( !event.target.matches('.dropbtn') ) {    
          document.getElementById( "myDropdown"  ).classList.remove("show");
          document.getElementById( "myDropdown2" ).classList.remove("show"); } }, false );

        document.getElementById( "toggle_raytracing" ).addEventListener("click", this.toggle_visible.bind( this ), false);
        document.getElementById( "submit_scene"      ).addEventListener("click", this.parse_file.bind(     this ), false);
      },
    'toggle_visible'() { this.visible = !this.visible; document.getElementById("progress").style = "display:inline-block;" },
    'set_color'( ix, iy, color )                           // Sends a color to one pixel index of our final result
      { var index = iy * this.width + ix;
        this.imageData.data[ 4 * index     ] = 255.9 * color[0];    
        this.imageData.data[ 4 * index + 1 ] = 255.9 * color[1];    
        this.imageData.data[ 4 * index + 2 ] = 255.9 * color[2];    
        this.imageData.data[ 4 * index + 3 ] = 255;  
      },
    'init_keys'( controls ) { controls.add( "SHIFT+r", this, this.toggle_visible ); },
    'display'( graphics_state )
      { graphics_state.lights = this.lights;
        graphics_state.projection_transform = perspective(90, 1, 1, 1000);
        if( this.camera_needs_reset ) { graphics_state.camera_transform = identity(); this.camera_needs_reset = false; }
        
        if( !this.visible )                          // Raster mode, to draw the same shapes out of triangles when you don't want to trace rays
        { for( let b of this.balls ) this.shapes.sphere.draw( graphics_state, b.model_transform, this.shader.material( b.color.concat(1), b.k_a, b.k_d, b.k_s, b.n ) );
          this.scanline = 0;    document.getElementById("progress").style = "display:none";     return; 
        } 
        if( !this.texture || !this.texture.loaded ) return;      // Don't display until we've got our first procedural image
        this.scratchpad_context.drawImage( this.texture.image, 0, 0 );
        this.imageData = this.scratchpad_context.getImageData( 0, 0, this.width, this.height );    // Send the newest pixels over to the texture
        var camera_inv = inverse( graphics_state.camera_transform );
        
        var desired_milliseconds_per_frame = 100;
        if( ! this.scanlines_per_frame ) this.scanlines_per_frame = 1;
        var milliseconds_per_scanline = Math.max( graphics_state.animation_delta_time / this.scanlines_per_frame, 1 );
        this.scanlines_per_frame = desired_milliseconds_per_frame / milliseconds_per_scanline + 1;
        for( var i = 0; i < this.scanlines_per_frame; i++ )     // Update as many scanlines on the picture at once as we can, based on previous frame's speed
        { var y = this.scanline++;
          if( y >= this.height ) { this.scanline = 0; document.getElementById("progress").style = "display:none" };
          document.getElementById("progress").innerHTML = "Rendering ( " + 100 * y / this.height + "% )..."; 
          for ( var x = 0; x < this.width; x++ )
          { var ray = { origin: mult_vec( camera_inv, vec4(0, 0, 0, 1) ), dir: mult_vec( camera_inv, this.get_dir( x, y ) ) };   // Apply camera
            this.set_color( x, y, this.trace( ray, [1,1,1], true ) );                                    // ******** Trace a single ray *********
          }
        }
        this.scratchpad_context.putImageData( this.imageData, 0, 0);          // Draw the image on the hidden canvas
        this.texture.image.src = this.scratchpad.toDataURL("image/png");      // Convert the canvas back into an image and send to a texture
        
        this.shapes.square.draw( new Graphics_State( identity(), identity(), 0 ), translation(0,0,-1), this.shader.material( Color( 0, 0, 0, 1 ), 1,  0, 0, 1, this.texture ) );
      }
  }, Scene_Component );
