package com.eduadmin.pro.ui.common

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * App-wide shimmer brush. One infinite transition shared across the whole composition
 * tree means every skeleton card pulses in perfect sync — no per-component drift.
 */
@Composable
fun shimmerBrush(
    baseColor:      Color = Color(0xFFE2E8F0),
    highlightColor: Color = Color(0xFFF8FAFC)
): Brush {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val x by transition.animateFloat(
        initialValue   = -400f,
        targetValue    = 800f,
        animationSpec  = infiniteRepeatable(tween(1000, easing = LinearEasing), RepeatMode.Restart),
        label          = "shimmerX"
    )
    return Brush.linearGradient(
        colors = listOf(baseColor, highlightColor, baseColor),
        start  = Offset(x, 0f),
        end    = Offset(x + 400f, 0f)
    )
}

/**
 * Single-call skeleton placeholder. Drop anywhere a real card would go;
 * swap it out once the data arrives.
 */
@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    height:   Dp,
    shape:    Shape = RoundedCornerShape(12.dp)
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(shape)
            .background(shimmerBrush())
    )
}
