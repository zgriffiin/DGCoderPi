type PointerCaptureDrag = {
	captureTarget: HTMLElement;
	pointerId: number;
};

function releasePointerCapture(drag: PointerCaptureDrag) {
	if (drag.captureTarget.hasPointerCapture(drag.pointerId)) {
		drag.captureTarget.releasePointerCapture(drag.pointerId);
	}
}

export function trackWindowPointerDrag<TDrag extends PointerCaptureDrag>(
	drag: TDrag,
	handlers: {
		onMove: (event: PointerEvent, drag: TDrag) => void;
		onEnd: (event: PointerEvent, drag: TDrag) => void;
	}
) {
	const handlePointerMove = (event: PointerEvent) => {
		handlers.onMove(event, drag);
	};
	const handlePointerUp = (event: PointerEvent) => {
		releasePointerCapture(drag);
		handlers.onEnd(event, drag);
	};

	window.addEventListener('pointermove', handlePointerMove);
	window.addEventListener('pointerup', handlePointerUp);
	return () => {
		releasePointerCapture(drag);
		window.removeEventListener('pointermove', handlePointerMove);
		window.removeEventListener('pointerup', handlePointerUp);
	};
}
