define([
        '../Core/Cartesian3',
        '../Core/Cartesian4',
        '../Core/BoundingRectangle',
        '../Core/Color',
        '../Core/defined',
        '../Core/destroyObject',
        '../Core/PixelFormat',
        '../Renderer/ClearCommand',
        '../Renderer/Framebuffer',
        '../Renderer/PassState',
        '../Renderer/PixelDatatype',
        '../Renderer/Renderbuffer',
        '../Renderer/RenderbufferFormat',
        '../Renderer/RenderState',
        '../Renderer/Sampler',
        '../Renderer/Texture',
        '../Renderer/TextureMagnificationFilter',
        '../Renderer/TextureMinificationFilter',
        '../Renderer/TextureWrap',
        '../Scene/DerivedCommand',
        '../Scene/PickDepth'
    ], function(
        Cartesian3,
        Cartesian4,
        BoundingRectangle,
        Color,
        defined,
        destroyObject,
        PixelFormat,
        ClearCommand,
        Framebuffer,
        PassState,
        PixelDatatype,
        Renderbuffer,
        RenderbufferFormat,
        RenderState,
        Sampler,
        Texture,
        TextureMagnificationFilter,
        TextureMinificationFilter,
        TextureWrap,
        DerivedCommand,
        PickDepth) {
    'use strict';

    /**
     * @private
     */
    function PickOffscreenFramebuffer() {
        this._colorTexture = undefined;
        this._depthStencilTexture = undefined;
        this._depthStencilRenderbuffer = undefined;
        this._framebuffer = undefined;
        this._clearCommand = undefined;
        this._passState = undefined;
    }

    function destroyResources(picker) {
        picker._framebuffer = picker._framebuffer && picker._framebuffer.destroy();
        picker._colorTexture = picker._colorTexture && picker._colorTexture.destroy();
        picker._depthStencilTexture = picker._depthStencilTexture && picker._depthStencilTexture.destroy();
        picker._depthStencilRenderbuffer = picker._depthStencilRenderbuffer && picker._depthStencilRenderbuffer.destroy();
    }

    function createResources(picker, context) {
        var width = 1;
        var height = 1;

        picker._colorTexture = new Texture({
            context : context,
            width : width,
            height : height,
            pixelFormat : PixelFormat.RGBA,
            pixelDatatype : PixelDatatype.UNSIGNED_BYTE,
            sampler : new Sampler({
                wrapS : TextureWrap.CLAMP_TO_EDGE,
                wrapT : TextureWrap.CLAMP_TO_EDGE,
                minificationFilter : TextureMinificationFilter.NEAREST,
                magnificationFilter : TextureMagnificationFilter.NEAREST
            })
        });

        if (context.depthTexture) {
            picker._depthStencilTexture = new Texture({
                context : context,
                width : width,
                height : height,
                pixelFormat : PixelFormat.DEPTH_STENCIL,
                pixelDatatype : PixelDatatype.UNSIGNED_INT_24_8,
                sampler : new Sampler({
                    wrapS : TextureWrap.CLAMP_TO_EDGE,
                    wrapT : TextureWrap.CLAMP_TO_EDGE,
                    minificationFilter : TextureMinificationFilter.NEAREST,
                    magnificationFilter : TextureMagnificationFilter.NEAREST
                })
            });
        } else {
            picker._depthStencilRenderbuffer = new Renderbuffer({
                context : context,
                width : width,
                height : height,
                format : RenderbufferFormat.DEPTH_STENCIL
            });
        }

        picker._framebuffer = new Framebuffer({
            context : context,
            colorTextures : [picker._colorTexture],
            depthStencilTexture : picker._depthStencilTexture,
            depthStencilRenderbuffer : picker._depthStencilRenderbuffer,
            destroyAttachments : false
        });

        var passState = new PassState(context);
        passState.framebuffer = picker._framebuffer;
        passState.viewport = new BoundingRectangle(0, 0, width, height);
        picker._passState = passState;

        picker._clearCommand = new ClearCommand({
            depth : 1.0,
            color : new Color(),
            owner : this
        });

        picker._pickDepth = new PickDepth();
    }

    PickOffscreenFramebuffer.prototype.begin = function(frameState) {
        var context = frameState.context;
        if (!defined(this._framebuffer)) {
            createResources(this, context);
        }
        var passState = this._passState;
        var clearCommand = this._clearCommand;

        // TODO : needed?
        clearCommand.execute(context, passState);

        return passState;
    };

    var scratchPackedDepth = new Cartesian4();
    var packedDepthScale = new Cartesian4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0);

    PickOffscreenFramebuffer.prototype.getDepth = function(frameState) {
        var width = 1.0;
        var height = 1.0;
        var context = frameState.context;

        var pickDepth = this._pickDepth;
        pickDepth.update(context, this._depthStencilTexture);
        pickDepth.executeCopyDepth(context, this._passState);

        var pixels = context.readPixels({
            x : 0,
            y : 0,
            width : width,
            height : height,
            framebuffer : pickDepth.framebuffer
        });

        var packedDepth = Cartesian4.unpack(pixels, 0, scratchPackedDepth);
        Cartesian4.divideByScalar(packedDepth, 255.0, packedDepth);
        return Cartesian4.dot(packedDepth, packedDepthScale);
    };

    PickOffscreenFramebuffer.prototype.isDestroyed = function() {
        return false;
    };

    PickOffscreenFramebuffer.prototype.destroy = function() {
        destroyResources(this);
        return destroyObject(this);
    };

    return PickOffscreenFramebuffer;
});
