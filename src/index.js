import domready from "domready"
import SimplexNoise from "simplex-noise"
import "./style.css"
import randomPalette from "./randomPalette";
import Color from "./Color";
import { clamp } from "./util";

const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const DEG2RAD_FACTOR = TAU / 360;

const config = {
    width: 0,
    height: 0
};

const noise = new SimplexNoise()

/**
 * @type CanvasRenderingContext2D
 */
let ctx;
let canvas;

const radius = 300
const distance = radius + 200
const brushSize = 80
const zFactor = 0.001
const numBlobs = 500;

const zSteps = 16;

function project(x,y,z)
{
    return [(x / (z*zFactor)), (y / (z*zFactor))];
}


function createBrushes(palette)
{
    const step = radius*2/zSteps;

    console.log(palette)

   return palette.map(
        (c,idx) => {

            const color =  Color.from(c).toRGBA(0.01)
            const brushes = []

            for (let z = distance + radius; z >= distance - radius; z -= step)
            {
                const size = Math.ceil(project(brushSize,0,z)[0])
                const minorSize = 0|(size/10)

                //console.log("Brush #", idx ,", color =", color, ": ", size + " x " + size)

                const canvas = document.createElement("canvas")
                canvas.width = size
                canvas.height = size

                const ctx = canvas.getContext("2d")

                ctx.fillStyle = color

                const hs = size/2
                const r2 = size/2 - minorSize

                for (let i=0; i < 5; i++)
                {
                    const angle = Math.random() * TAU;
                    const rnd = Math.random();
                    const r = rnd * rnd * r2

                    const x = hs + Math.cos(angle) * r
                    const y = hs + Math.sin(angle) * r

                    ctx.beginPath()
                    ctx.moveTo(x + minorSize, y)
                    ctx.arc(x,y, minorSize, 0, TAU, true)
                    ctx.fill()
                }
                brushes.push(canvas)
            }

            return brushes;
        })


    //console.log("BRUSHES", brushes)

}


export function clampBrush(v)
{
    return v < 0 ? 0 : v > zSteps ? zSteps : v;
}

let stopped = false;


function dither(ctx)
{
    const { width, height } = config
    const imageData = ctx.getImageData(0,0, width, height);
    const { data } = imageData;

    const spread = 40;

    for (let y = 0; y < height; y++)
    {
        for (let x = 0; x < width; x++)
        {
            const rnd = Math.random();
            const radius = rnd * rnd * spread
            const angle = TAU * Math.random();

            const x0 = 0|( x + Math.cos(angle) * radius)
            const y0 = 0|( y + Math.sin(angle) * radius)

            let r,g,b,a
            if (!(y0 < 0 || x0 < 0 || x0 >= width || y0 >= height))
            {
                const off1 = (y0 * width + x0) * 4;

                r = data[off1]
                g = data[off1 + 1]
                b = data[off1 + 2]
                a = data[off1 + 3]

                const off0 = (y * width + x) * 4;
                data[off0    ] = r
                data[off0 + 1] = g
                data[off0 + 2] = b
                data[off0 + 3] = a
            }
        }
    }

    ctx.putImageData(imageData,0,0)

}


let frameCount;

domready(
    () => {

        canvas = document.getElementById("screen");
        ctx = canvas.getContext("2d");

        const width = (window.innerWidth) | 0;
        const height = (window.innerHeight) | 0;

        config.width = width;
        config.height = height;

        canvas.width = width;
        canvas.height = height;

        let palette, brushes, blobs, postDraw

        const init = () => {
            ctx.fillStyle = "#000";
            ctx.fillRect(0,0, width, height);


            palette = randomPalette()
            brushes = createBrushes(palette)

            blobs = new Array(numBlobs)
            for (let i=0; i < numBlobs; i++ )
            {

                const u = Math.random();
                const v = Math.random();
                const theta = 2 * Math.PI * u;
                const phi = Math.acos(2 * v - 1);
                let x = (radius * Math.sin(phi) * Math.cos(theta));
                let y = (radius * Math.sin(phi) * Math.sin(theta));
                let z = (radius * Math.cos(phi));
                blobs[i] = {
                    x,y,z,
                    brushes: brushes[0|Math.random() * brushes.length]
                }
            }

            postDraw = 0|(5 + Math.random() * 5)
        }

        init()


        const cx = width * 0.5
        const cy = height * 0.5




        const paint = () => {
            for (let j = 0; j < blobs.length; j++)
            {
                const blob = blobs[j];
                let { x, y, z, brushes } = blob;

                const z0 = distance + z;
                const [x2,y2] = project(x, y, z0)
                const zStep = 0 | (z0 - (distance - radius)) * zSteps / (radius * 2)
                //console.log("x", x2, "y", y2, "zStep", zStep)
                const brush = brushes[clampBrush(zSteps - zStep)]


                ctx.drawImage(brush, 0|(cx + x2 - brush.width/2), 0|(cy + y2 - brush.height/2))

                const noiseScale = 0.01

                const nx0 = x * noiseScale
                const ny0 = y * noiseScale
                const nz0 = z * noiseScale

                const curlFactor = 1
                const e = 0.1;
                const  n1 = noise.noise3D(nx0, ny0 + e, nz0);
                const  n2 = noise.noise3D(nx0, ny0 - e, nz0);
                const  n3 = noise.noise3D(nx0, ny0, nz0 + e);
                const  n4 = noise.noise3D(nx0, ny0, nz0 - e);
                const  n5 = noise.noise3D(nx0 + e, ny0, nz0);
                const  n6 = noise.noise3D(nx0 - e, ny0, nz0);

                const dx = n2 - n1 - n4 + n3;
                const dy = n4 - n3 - n6 + n5;
                const dz = n6 - n5 - n2 + n1;

                const f = curlFactor/Math.sqrt(dx*dx+dy*dy+dz*dz);

                x += dx * f;
                y += dy * f;
                z += dz * f;

                // const d = Math.sqrt(x*x+y*y*z*z);
                // if (d > radius)
                // {
                //     x *= 0.99
                //     y *= 0.99
                //     z *= 0.99
                // }


                blob.x = x
                blob.y = y
                blob.z = z

            }

        }

        const animate = () => {
            paint()


            if (frameCount === postDraw)
            {
                dither(ctx)
            }

            if (frameCount > postDraw)
            {
                ctx.fillStyle = "rgba(0,0,0,0.01)"
                ctx.fillRect(0,0,width,height)
            }

            if (frameCount-- > 0)
            {
                requestAnimationFrame(animate)
            }
            else
            {
                stopped = true
            }
        }

        const restart = () => {
            frameCount = 0|(200 + Math.random() * 100)
            requestAnimationFrame(animate)
            stopped = false
        }

        init()
        restart()

        window.addEventListener("click", () => {
            init()
            restart()
        }, true)
    }
);
