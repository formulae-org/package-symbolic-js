/*
Fōrmulæ symbolic package. Module for expression definition & visualization.
Copyright (C) 2015-2026 Laurence R. Ugalde

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

export class Symbolic extends Formulae.Package {}

Symbolic.Symbol = class extends Expression.Literal {
	constructor() {
		super();
		this.color = "blue";
		this.reference = null;
	}
	
	getTag() { return "Symbolic.Symbol"; }
	getName() { return Symbolic.messages.nameSymbol; }
	getLiteral() { return this.literal; }
	
	set(name, value) {
		switch(name) {
			case "Name":
				this.literal = value;
				break;
			
			case "Reference":
				this.reference = value;
				break;
			
			default:
				super.set(name, value);
		}
	}
	
	get(name) {
		switch (name) {
			case "Name":
				return this.literal;
				
			case "Reference":
				return this.reference;
		}
		
		super.get(name);
	}
	
	getSerializationNames() {
		return [ "Name" ];
	}
	
	async getSerializationStrings() {
		return [ this.literal ];
	}
	
	setSerializationStrings(strings, promises) {
		if (strings[0].length == 0) {
			throw "Invalid name of symbol";
		}
		
		this.set("Name", strings[0]);
	}
	
	isReduced() {
		return false;
	}
	
	prepareDisplay(context) {
		let bkp = context.fontInfo.italic;
		context.fontInfo.setItalic(context, true);
		
		this.prepareDisplayAsLiteral(context);
		
		context.fontInfo.setItalic(context, bkp);
	}
	
	display(context, x, y) {
		let bkp = context.fontInfo.italic;
		context.fontInfo.setItalic(context, true);
		
		this.displayAsLiteral(context, x, y);
		
		context.fontInfo.setItalic(context, bkp);
	}
}

Symbolic.FunctionExpression = class extends Expression.BinaryExpression {
	getTag() { return "Symbolic.Function"; }
	getName() { return Symbolic.messages.nameFunction; }
	getChildName(index) { return Symbolic.messages.childrenFunction[index]; }
	
	prepareDisplay(context) {
		let functionExpression = this.children[0];
		let argumentsExpression = this.children[1];
		
		functionExpression.prepareDisplay(context);
		
		if (argumentsExpression.getTag() === "List.List") {
			argumentsExpression.prepareDisplayAsList(context, 4, 4);
		}
		else {
			argumentsExpression.prepareDisplay(context);
		}
		
		functionExpression.x = 0;
		argumentsExpression.x = functionExpression.width + 3;
		
		if (functionExpression.parenthesesAsOperator()) {
			functionExpression.x += 4;
			argumentsExpression.x += 4 + 4;
		}
		
		this.width = argumentsExpression.x + argumentsExpression.width;
		
		this.vertBaseline = Math.round(this.width / 2);
		this.horzBaseline = Math.max(functionExpression.horzBaseline, argumentsExpression.horzBaseline);
		
		functionExpression.y = this.horzBaseline - functionExpression.horzBaseline;
		argumentsExpression.y = this.horzBaseline - argumentsExpression.horzBaseline;
		
		this.height = this.horzBaseline + Math.max(
			functionExpression.height - functionExpression.horzBaseline,
			argumentsExpression.height - argumentsExpression.horzBaseline
		);
	}
	
	display(context, x, y) {
		let functionExpression = this.children[0];
		let argumentsExpression = this.children[1];
		
		if (functionExpression.parenthesesAsOperator()) {
			functionExpression.drawParenthesesAround(context, x + functionExpression.x, y + functionExpression.y);
		}
		functionExpression.display(context, x + functionExpression.x, y + functionExpression.y);
		
		if (argumentsExpression.getTag() === "List.List") {
			argumentsExpression.displayAsList(context, x + argumentsExpression.x, y + argumentsExpression.y);
			this.drawParentheses(context, x + argumentsExpression.x,                             y + argumentsExpression.y, argumentsExpression.height, true );
			this.drawParentheses(context, x + argumentsExpression.x + argumentsExpression.width, y + argumentsExpression.y, argumentsExpression.height, false);
		}
		else {
			argumentsExpression.display(context, x + argumentsExpression.x, y + argumentsExpression.y);
		}
	}
}

Symbolic.Lambda = class extends Expression.BinaryExpression {
	getTag() { return "Symbolic.Lambda"; }
	getName() { return Symbolic.messages.nameLambda; }
	getChildName(index) { return Symbolic.messages.childrenLambda[index]; }
	
	prepareDisplay(context) {
		let parameters = this.children[0];
		let body = this.children[1];
		
		parameters.prepareDisplay(context);
		body.prepareDisplay(context);
		
		//let parenthesesBody = body.parenthesesAsOperator();
		let parenthesesBody = false;
		
		this.horzBaseline = Math.round(Math.max(
			parameters.horzBaseline,
			body.horzBaseline,
			context.fontInfo.semiHeight
		));
		let maxSemiHeight = Math.round(Math.max(
			parameters.height - parameters.horzBaseline,
			body.height - body.horzBaseline,
			context.fontInfo.semiHeight
		));
		this.height = this.horzBaseline + maxSemiHeight;
		
		this.width = Math.round(context.measureText("λ").width) + 5;
		parameters.x = this.width;
		this.width += parameters.width + 5 + Math.round(context.measureText(".").width) + 5;
		if (parenthesesBody) this.width += 4;
		body.x = this.width;
		this.width += body.width;
		if (parenthesesBody) this.width += 4;
		
		this.vertBaseline = Math.round(this.width / 2);
		
		parameters.y = this.horzBaseline - parameters.horzBaseline;
		body.y = this.horzBaseline - body.horzBaseline;
	}
	
	display(context, x, y) {
		let parameters = this.children[0];
		let body = this.children[1];
		
		this.drawText(context, "λ", x, y + this.horzBaseline + context.fontInfo.semiHeight);
		parameters.display(context, x + parameters.x, y + parameters.y);
		
		this.drawText(context, ".", x + parameters.x + parameters.width + 5, y + this.horzBaseline + context.fontInfo.semiHeight);
		body.display(context, x + body.x, y + body.y);
		
		//if (body.parenthesesAsOperator()) {
		//	body.drawParenthesesAround(context, x + body.x, y + body.y);
		//}
	}
}

Symbolic.LambdaApplication = class extends Expression.BinaryExpression {
	getTag() { return "Symbolic.LambdaApplication"; }
	getName() { return Symbolic.messages.nameLambdaApplication; }
	getChildName(index) { return Symbolic.messages.childrenLambdaApplication[index]; }
	
	prepareDisplay(context) {
		let left = this.children[0];
		let right = this.children[1];
		
		left.prepareDisplay(context);
		right.prepareDisplay(context);
		
		let parenthesesLeft = left.parenthesesAsOperator() || left.parenthesesWhenSuperSubscripted() || left.getTag() === "Symbolic.Lambda";
		//let parenthesesRight = right.getTag() !== "List.List";
		let parenthesesRight = right.parenthesesAsOperator();
		
		this.width = 0;
		if (parenthesesLeft) this.width += 4;
		left.x = this.width;
		this.width += left.width;
		if (parenthesesLeft) this.width += 4;
		
		this.width += 3;
		
		if (parenthesesRight) this.width += 4;
		right.x = this.width;
		this.width += right.width;
		if (parenthesesRight) this.width += 4;
		
		this.horzBaseline = Math.max(left.horzBaseline, right.horzBaseline);
		left.y = this.horzBaseline - left.horzBaseline;
		right.y = this.horzBaseline - right.horzBaseline;
		
		this.height = this.horzBaseline + Math.max(left.height - left.horzBaseline, right.height - right.horzBaseline);
		this.vertBaseline = this.width / 2;
	}
	
	display(context, x, y) {
		let left = this.children[0];
		let right = this.children[1];
		
		left.display(context, x + left.x, y + left.y);
		if (left.parenthesesAsOperator() || left.parenthesesWhenSuperSubscripted() || left.getTag() === "Symbolic.Lambda") {
			left.drawParenthesesAround(context, x + left.x, y + left.y);
		}
		
		right.display(context, x + right.x, y + right.y);
		//if (right.getTag() !== "List.List") {
		if (right.parenthesesAsOperator()) {
			right.drawParenthesesAround(context, x + right.x, y + right.y);
		}
	}
}

Symbolic.setExpressions = function(module) {
	Formulae.setExpression(module, "Symbolic.Symbol",            Symbolic.Symbol);
	Formulae.setExpression(module, "Symbolic.Function",          Symbolic.FunctionExpression);
	Formulae.setExpression(module, "Symbolic.Lambda",            Symbolic.Lambda);
	Formulae.setExpression(module, "Symbolic.LambdaApplication", Symbolic.LambdaApplication);
	
	// assignment
	Formulae.setExpression(
		module,
		"Symbolic.Assignment",
		{
			clazz:        Expression.Infix,
			getTag:       () => "Symbolic.Assignment",
			getOperator:  () => this.messages.operatorAssignment,
			getName:      () => this.messages.nameAssignment,
			getChildName: index => this.messages.childrenAssignment[index],
			parentheses:  false,
			inverted:     true,
			min: 2, max: 2
		}
	);
	
	// local
	Formulae.setExpression(
		module,
		"Symbolic.Local",
		{
			clazz:       Expression.PrefixedLiteral,
			getTag:      () => "Symbolic.Local",
			getLiteral:  () => this.messages.literalLocal,
			getName:     () => this.messages.nameLocal,
			color:       "orange",
			bold:        true,
			space:       10,
			parentheses: false
		}
	);
	
	// λ and λ-builder
	//[ "Lambda", "LambdaBuilder" ].forEach(tag => Formulae.setExpression(
	[ "LambdaBuilder" ].forEach(tag => Formulae.setExpression(
		module,
		"Symbolic." + tag,
		{
			clazz:       Expression.Infix,
			getTag:      () => "Symbolic." + tag,
			getOperator: () => Symbolic.messages.operatorLambda,
			getName:     () => Symbolic.messages["name" + tag],
			color:       tag === "LambdaBuilder" ? "orange" : null,
			inverted:    true,
			min: 2, max: 2
		}
	));
	
	// return
	Formulae.setExpression(
		module,
		"Symbolic.Return",
		{
			clazz:       Expression.PrefixedLiteral,
			getTag:      () => "Symbolic.Return",
			getLiteral:  () => this.messages.literalReturn,
			getName:     () => this.messages.nameReturn,
			bold:        true,
			space:       10,
			parentheses: false
		}
	);
	
	// function
	//[ "Return", "Undefine" ].forEach(tag => Formulae.setExpression(
	[ "Undefine" ].forEach(tag => Formulae.setExpression(
		module,
		"Symbolic." + tag,
		{
			clazz:       Expression.Function,
			getTag:      () => "Symbolic." + tag,
			getMnemonic: () => Symbolic.messages["mnemonic" + tag],
			getName:     () => Symbolic.messages["name" + tag],
			parentheses: tag === "Return" ? false : null,
			min: 1, max: 1
		}
	));
};

