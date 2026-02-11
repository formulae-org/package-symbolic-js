/*
Fōrmulæ symbolic package. Module for reduction.
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

Symbolic.ReturnError = class extends Error {};

// local Symbol   --->   local declaration of symbol
// Symbol         --->   replacing

Symbolic.symbolReducer = async (symbol, session) => {
	let symbolName = symbol.get("Name");
	
	// LOCAL symbol ?
	if (symbol.parent instanceof Expression && symbol.parent.getTag() === "Symbolic.Local") {
		if (symbol.getFromScope(symbolName, false) === null) {
			symbol.putIntoScope(symbolName,	new ScopeEntry(), false);
			
			//session.log("Local symbol declaration");
			return true;
		}
	}
	
	let entry = symbol.getFromScope(symbolName, true);
	
	if (entry === null) {
		symbol.setReduced();
		return false; // Ok, it is a pure symbol
	}
	
	let value = entry.getValue();
	if (value === null) {
		symbol.setReduced();
		return false; // Ok, it is a pure symbol
	}
	
	let copy = value.clone();
	//session.prepareReduction(copy);
	
	symbol.replaceBy(copy);
	await session.reduce(copy);
	return true;
};

// [LOCAL] symbol <- expression
// 
// It must be special reducer in order to prevent symbol reduction

Symbolic.assignmentSymbolReducer = async (assignment, session) => {
	//console.log(assignment);
	let symbol = assignment.children[0];
	
	if (symbol.getTag() !== "Symbolic.Symbol") return false;
	
	let symbolName = symbol.get("Name");
	let value = await session.reduceAndGet(assignment.children[1], 1);
	//console.log(value.clone());
	
	// LOCAL [ symbol <- value ]
	let local =
		assignment.parent instanceof Expression &&
		assignment.parent.getTag() === "Symbolic.Local";
	
	let entry = assignment.getFromScope(symbolName, !local);
	if (entry !== null) {
		entry.setValue(value.clone());
	}
	else {
		assignment.putIntoScope(
			symbolName,
			new ScopeEntry(value.clone()),
			!local
		);
	}
	
	assignment.replaceBy(value.clone());
	//session.log("Assignment to symbol");
	return true;
};

// { l1, l2, ..., ln } <- expr
//
// Evaluates expr, it is intended to reduce to a n-list { r1, r2, ..., rn } then, it does
// { l1 <- r1, l2 <- r2, ..., ln <- rn }
//
// it must be special reducer in order to prevent symbol reduction

Symbolic.assignmentListReducer = async (assignment, session) => {
	let left = assignment.children[0];
	if (left.getTag() !== "List.List") {
		return false; // Ok, forward to other forms of assignment
	}
	
	let right = await session.reduceAndGet(assignment.children[1], 1);
	
	if (right.getTag() !== "List.List") {
		ReductionManager.setInError(right, "Expression must be a list");
		throw new ReductionError();
	}
	if (left.children.length != right.children.length) {
		ReductionManager.setInError(right, "Invalid cardinality");
		throw new ReductionError();
	}
	
	let list = Formulae.createExpression("List.List");
	let assign;
	
	for (let i = 0, n = left.children.length; i < n; ++i) {
		assign = Formulae.createExpression("Symbolic.Assignment");
		assign.addChild(left.children[i]);
		assign.addChild(right.children[i]);
		
		list.addChild(assign);
	}
	
	assignment.replaceBy(list);
	//session.log("Assignment on a list");
	
	await session.reduce(list);
	return true;
};

// symbol
//       spec
//
// it must be pre-reducer in order to prevent symbol reduction

Symbolic.childSymbolReducer = async (child, session) => {
	let symbol = child.children[0];
	
	if (symbol.getTag() !== "Symbolic.Symbol") {
		return false; // Ok, forward to other kinds of childhood
	}
	
	let entry = symbol.getFromScope(symbol.get("Name"), true); // globally
	if (entry === null) {
		symbol.setReduced();
		return false; // Ok, it is a free symbol
	}
	
	//console.log(child);
	//console.log(child.children[1]);
	//console.log(await session.reduceAndGet(child.children[1], 1));
	//console.trace();
	//throw "error";
	
	let result = CanonicalIndexing.getChildBySpec(
		entry.getValue(),
		await session.reduceAndGet(child.children[1], 1)
	).clone();
	
	//if (result == null) {
	//	throw new ReductionException();
	//}
	
	child.replaceBy(result);
	await session.reduce(result);
	
	return true;
};

// symbol    <-  expression
//      spec
//
// non-creational assignment, symbol might have been previously defined,
// so no local nor global distinction
// it must be pre-reducer in order to prevent symbol reduction

Symbolic.assignmentChildSymbolReducer = async (assignment, session) => {
	let child = assignment.children[0];
	
	if (child.getTag() !== "Expression.Child") {
		return false; // Ok, forward to other forms of assignment
	}
	
	let symbol = child.children[0];
	if (symbol.getTag() !== "Symbolic.Symbol") {
		return false; // Ok, forward to other forms of assignment
	}
	
	let entry = symbol.getFromScope(symbol.get("Name"), true); // globally
	if (entry === null) {
		symbol.setReduced();
		return false; // Ok, it is a free symbol
	}
	
	let spec = await session.reduceAndGet(child.children[1], 1);
	let right = await session.reduceAndGet(assignment.children[1], 1);
	
	let deep = CanonicalIndexing.getChildBySpec(
		entry.getValue(),
		spec,
	);
	
	//if (deep == null) {
	//	throw new ReductionException();
	//}
	
	deep.replaceBy(right.clone());
	
	assignment.replaceBy(right);
	//session.log("Symbol child updated");
	return true;
};

// function(expr, {arg1, arg2, ..., argn})
//
// converts to
// LambdaApplication(expr, {arg1, arg2, ..., argn})

Symbolic.functionReducer = async (f, session) => {
	let application = Formulae.createExpression("Symbolic.LambdaApplication");
	application.addChild(f.children[0]);
	application.addChild(f.children[1]);
	
	f.replaceBy(application);
	//session.log("Function call");
	
	await session.reduce(application);
	return true;
};

// function(expr, {arg1, arg2, ..., argn})   <-   body
//
// * It must be pre-reducer in order to prevent body and arguments reduction
// * It converts to
//      expr <- Protect(Lambda({arg1, arg2, ..., argn}, body)

Symbolic.assignmentFunctionReducer = async (assignment, session) => {
	let f = assignment.children[0];
	if (f.getTag() !== "Symbolic.Function") {
		return false; // Ok, forward to other forms of assignment
	}
	
	let expr = f.children[0];
	let args = f.children[1];
	let body = assignment.children[1];
	
	let lambda = Formulae.createExpression("Symbolic.Lambda");
	lambda.addChild(args);
	lambda.addChild(body);
	
	let protect = Formulae.createExpression("Expression.Protect");
	protect.addChild(lambda)

	assignment.setChild(0, expr);
	assignment.setChild(1, protect);
	
	//session.log("Assignment to function");
	await session.reduce(assignment);
	
	return true;
};
	
// (1)
// LOCAL { e1, e2, ..., en }   =>   { LOCAL e1, LOCAL e2, ..., LOCAL en }
//
// (2)
// LOCAL { l1, l2, ..., ln } <- expr
// evaluates expr, it is intended to reduce to a n-list { r1, r2, ..., rn }
// then, it does
// { LOCAL l1 <- r1, LOCAL l2 <- r2, ..., LOCAL ln <- rn }
//
// it must be special reducer in order to prevent symbol reduction
	
Symbolic.localArrayReducer = async (local, session) => {
	let child = local.children[0];
	let tag;
	
	// (1)
	if ((tag = child.getTag()) === "List.List") {
		for (let i = 0, n  = child.children.length; i < n; ++i) {
			let loc = Formulae.createExpression("Symbolic.Local");
			loc.addChild(child.children[i]);
			
			child.setChild(i, loc);
		}
		
		local.replaceBy(child);
		//session.log("Local of an array");
		await session.reduce(child);
		return true;
	}
	
	// (2)
	if (tag === "Symbolic.Assignment") {
		let left = child.children[0];
		if (left.getTag() !== "List.List") {
			return false; // Ok, forward to other forms of assignment
		}
		
		let right = child.children[1];
		right = await session.reduceAndGet(right, 1);
		
		if (right.getTag() !== "List.List") {
			ReductionManager.setInError(right, "Expression must be a list");
			throw new ReductionError();
		}
		if (left.children.length !== right.children.length) {
			ReductionManager.setInError(right, "Invalid cardinality");
			throw new ReductionError();
		}
		
		let list = Formulae.createExpression("List.List");
		
		for (let i = 0, n = left.children.length; i < n; ++i) {
			let assignment = Formulae.createExpression("Symbolic.Assignment");
			assignment.addChild(left.children[i]);
			assignment.addChild(right.children[i]);
			
			let loc = Formulae.createExpression("Symbolic.Local");
			loc.addChild(assignment);
			
			list.addChild(loc);
		}
		
		local.replaceBy(list);
		//session.log("Local assignment on a list");
		
		await session.reduce(list);
		return true;
	}
	
	return false; // Ok, forward to other forms of assignment
};
	
Symbolic.localReducer = async (local, session) => {
	local.replaceBy(local.children[0]);
	//session.log("Local definition");
	return true;
};
	
// Undefine(symbol)
// it must be pre-reducer in order to prevent symbol reduction
	
Symbolic.undefineReducer = async (undefine, session) => {
	let symbol = undefine.children[0];
	
	if (symbol.getTag() !== "Symbolic.Symbol") {
		ReductionManager.setInError(symbol, "Expression must be a symbol");
		throw new ReductionError();
	}
	
	//if (!symbol.removeFromScope(symbol)) {
	//	return false;
	//}
	
	symbol.removeFromScope(symbol.get("Name"));
	
	undefine.replaceBy(Formulae.createExpression("Null"));
	//session.log("Symbol undefinition");
	return true;
};

// Cardinality(symbol)
// it must be pre-reducer in order to prevent symbol reduction

Symbolic.cardinalitySymbolReducer = async (count, session) => {
	let symbol = count.children[0];
	
	if (symbol.getTag() !== "Symbolic.Symbol") {
		return false; // Ok, forward to other forms of Cardinality
	}
	
	let entry = symbol.getFromScope(symbol.get("Name"), true);
	if (entry === null) {
		ReductionManager.setInError(symbol, "Expression must be a bound symbol");
		throw new ReductionError();
	}
	
	count.replaceBy(
		Arithmetic.createInternalNumber(
			Arithmetic.createInteger(entry.getValue().children.length, session),
			session
		)
	);
	//session.log("Cardinality retrieved");
	return true;
};
	
// Cardinality(symbol	)
//			        spec
// it must be pre-reducer in order to prevent symbol reduction
	
Symbolic.cardinalityChildSymbolReducer = async (count, session) => {
	let child = count.children[0];
	
	if (child.getTag() !== "Expression.Child") {
		return false; // Ok, forward to other forms of Cardinality
	}
	
	let symbol = child.children[0];
	if (symbol.getTag() !== "Symbolic.Symbol") {
		return false; // Ok, forward to other forms of Cardinality
	}
	
	let entry = symbol.getFromScope(symbol.get("Name"), true);
	if (entry == null) {
		ReductionManager.setInError(symbol, "Expression must be a bound symbol");
		throw new ReductionError();
	}
	
	let spec = await session.reduceAndGet(child.children[1], 1);
	
	let x = CanonicalIndexing.getChildBySpec(entry.getValue(), spec);
	if (x === null) {
		throw new ReductionError();
	}
	
	count.replaceBy(
		Arithmetic.createInternalNumber(
			Arithmetic.createInteger(x.children.length, session),
			session
		)
	);
	
	return true;
};
	
Symbolic.returnReducer = async (expr, session) => {
	throw new Symbolic.ReturnError("", { cause: expr.children[0] });
};
	
// Append(symbol, expr)[special, high]

// it must be special in order to prevent symbol reduction
// It must be high precedence to have priority over other forms, specially Expression.Append(e1, e2)
//
// See: Expression.Append(e1, e2)
	
Symbolic.appendSymbolReducer = async (_append, session) => {
	let symbol = _append.children[0];
	if (symbol.getTag() !== "Symbolic.Symbol") {
		return false; // Ok, forward to other forms of Append
	}
	
	let addend = await session.reduceAndGet(_append.children[1], 1);
	
	let entry = symbol.getFromScope(symbol.get("Name"), true);
	if (entry === null) {
		ReductionManager.setInError(symbol, "Expression must be a bound symbol");
		throw new ReductionError();
	}
	let value = entry.getValue();
	
	if (!value.canInsertChildAt(value.children.length)) {
		ReductionManager.setInError(_append, "Expression cannot be appended");
		throw new ReductionError();
	}
	
	value.addChild(addend.clone());
	
	_append.replaceBy(addend);
	//session.log("Expression appended");
	return true;
};
	
// Prepend(symbol, expr)[special, high]
// it must be special in order to prevent symbol reduction
// It must be high precedence to have priority over other forms, specially Expression.Prepend(e1, e2)
//
// See: Expression.Prepend(e1, e2)
	
Symbolic.prependSymbolReducer = async (prepend, session) => {
	let symbol = prepend.children[0];
	if (symbol.getTag() !== "Symbolic.Symbol") {
		return false; // Ok, forward to other forms of Prepend
	}
	
	let addend = await session.reduceAndGet(prepend.children[1], 1);
	
	let entry = symbol.getFromScope(symbol.get("Name"), true);
	if (entry === null) {
		ReductionManager.setInError(symbol, "Expression must be a bound symbol");
		throw new ReductionError();
	}
	let value = entry.getValue();
	
	if (!value.canInsertChildAt(0)) {
		ReductionManager.setInError(prepend, "Expression cannot be prepended");
		throw new ReductionError();
	}
	
	value.addChildAt(0, addend.clone());
	
	prepend.replaceBy(addend);
	//session.log("expression prepended");
	return true;
};
	
// Insert(symbol, expr, pos)
// it must be special in order to prevent symbol reduction
// It must be high precedence to have priority over other forms, specially Expression.Insert(e1, e2, pos)
//
// See: Expression.Insert(e1, e2, pos)
	
Symbolic.insertSymbolReducer = async (insert, session) => {
	// symbol
	let symbol = insert.children[0];
	if (symbol.getTag() !== "Symbolic.Symbol") {
		return false; // forward to other forms of Insert
	}
	
	let entry = symbol.getFromScope(symbol.get("Name"), true);
	if (entry === null) {
		ReductionManager.setInError(symbol, "Expression must be a bound symbol");
		throw new ReductionError();
	}
	let value = entry.getValue();
	
	let pos;
	if (insert.children.length >= 3) {
		let _N = await session.reduceAndGet(insert.children[2], 2);
		pos = Arithmetic.getNativeInteger(_N);
		
		if (pos === undefined) {
			ReductionManager.setInError(_N, "Expression must be an integer number");
			throw new ReductionError();
		}
		
		let n = value.children.length;
		
		if (pos < 0) {
			pos = n + pos + 2;
		}
		
		if (pos < 1 || pos > n + 1) {
			ReductionManager.setInError(_N, "index out of range");
			throw new ReductionError();
		}
	}
	else {
		pos = value.children.length + 1;
	}
	
	if (!value.canInsertChildAt(pos - 1)) {
		ReductionManager.setInError(insert, "Expression cannot be inserted");
		throw new ReductionError();
	}
	
	// element
	let element = await session.reduceAndGet(insert.children[1], 1);
	
	////////////////////
	
	value.addChildAt(pos - 1, element);
	insert.replaceBy(element);
	
	//session.log("Expression inserted");
	return true;
};
	
// Delete(symbol, pos)
// it must be special in order to prevent symbol reduction
// It must be high precedence to have priority over other forms, specially Expression.Delete(expr, pos)
//
// See: Expression.Delete(expr, pos)
	
Symbolic.deleteSymbolReducer = async (deleteExpr, session) => {
	// symbol
	let symbol = deleteExpr.children[0];
	if (symbol.getTag() !== "Symbolic.Symbol") {
		return false; // forward to other forms of Delete
	}
	
	let entry = symbol.getFromScope(symbol.get("Name"), true);
	if (entry === null) {
		ReductionManager.setInError(symbol, "Expression must be a bound symbol");
		throw new ReductionError();
	}
	let value = entry.getValue();
	
	// n
	let _N = await session.reduceAndGet(deleteExpr.children[1], 1);
	
	let pos = Arithmetic.getNativeInteger(_N);
	if (pos === undefined) {
		ReductionManager.setInError(_N, "Expression is not an integer number");
		throw new ReductionError();
	}
	
	let n = value.children.length;
	
	if (pos < 0) {
		pos = n + pos + 1;
	}
	
	if (pos < 1 || pos > n) {
		ReductionManager.setInError(_N, "index out of range");
		throw new ReductionError();
	}
	
	if (!value.canRemoveChildAt(pos - 1)) {
		ReductionManager.setInError(deleteExpr, "Expression cannot be deleted");
		throw new ReductionError();
	}
	
	////////////////////
	
	deleteExpr.replaceBy(value.removeChildAt(pos - 1));
	//session.log("Expression deleted");
	return true;
};

// Lambda expression
// Lambda(arguments, expr)
// it must be special in order to prevent symbol reduction
// It does nothing
	
Symbolic.lambdaReducer = async (lambda, session) => {
	/////
	//session.log("Lambda expression");
	//await session.reduce(lambda.children[1]);
	/////
	
	return true;
};

// Lambda application

Symbolic.FULL_SUBSTITUTION = true;

Symbolic.identifier = 0;

Symbolic.getNextIdentifier = () => {
	++Symbolic.identifier;
	return Symbolic.identifier;
}

/*
Symbolic.replaceSymbol = (expr, from, to) => {
	if (expr.getTag() === "Symbolic.Symbol") {
		let name = expr.get("Name");
		if (name === from) {
			expr.set("Name", to);
		}
	}
	else {
		for (let i = 0, n = expr.children.length; i < n; ++i) {
			Symbolic.replaceSymbol(expr.children[i], from, to);
		}
	}
};
*/

Symbolic.replaceSymbol = (expr, name, to) => {
	let tag = expr.getTag();
	
	if (tag === "Symbolic.Symbol") {
		if (expr.get("Name") === name) {
			expr.replaceBy(to.clone());
			return;
		}
	}
	
	if (tag === "Symbolic.Lambda") {
		let parameters = expr.children[0];
		for (let i = 0, n = parameters.children.length; i < n; ++i) {
			if (parameters.children[i].get("Name") === name) {
				return;
			}
		}
		
		// The symbol is not in the parameter list of the lambda expression
		// so, the symbol is free in the body of the lambda expression
		// it is safe to substitute the symbol by its value in the body of the lambda expression
		
		Symbolic.replaceSymbol(expr.children[1], name, to);
		return;
	}
	
	if (tag === "Symbolic.Assignment") {
		let lvalue = expr.children[0];
		let tag = lvalue.getTag();
		
		if (tag === "Symbolic.Function") {
			let parameters = lvalue.children[1];
			for (let i = 0, n = parameters.children.length; i < n; ++i) {
				if (parameters.children[i].get("Name") === name) {
					return;
				}
			}
		}
			
		// The symbol is not in the parameter list of the function
		// so, the symbol is free in the body of the function
		// it is safe to substitute the symbol by its value in the body of function
		
		Symbolic.replaceSymbol(expr.children[1], name, to);
		return;
	}
	
	for (let i = 0, n = expr.children.length; i < n; ++i) {
		Symbolic.replaceSymbol(expr.children[i], name, to);
	}
};

// LambdaApplication(lambda, values)

Symbolic.lambdaApplication = async (app, session) => {
	let lambda = app.children[0];
	let tag = lambda.getTag();
	
	if (tag === "Symbolic.Symbol") {
		return false; // Ok, to forward to other forms of LambdaApplication(...)
	}
	
	if (tag !== "Symbolic.Lambda") {
		ReductionManager.setInError(lambda, "Expression must be a lambda");
		throw new ReductionError();
	}
	
	let parameters = lambda.children[0];
	if (parameters.getTag() !== "List.List") {
		ReductionManager.setInError(parameters, "Expression must be a list");
		throw new ReductionError();
	}
	
	let values = app.children[1];
	if (values.getTag() !== "List.List") {
		ReductionManager.setInError(values, "Expression must be a list");
		throw new ReductionError();
	}
	
	if (values.children.length > parameters.children.length) {
		ReductionManager.setInError(values, "Invalid cardinality");
		throw new ReductionError();
	}
	
	///////////////////////
	
	await session.reduce(values); // reduction of values first
	
	///////////////////////
	
	let body = lambda.children[1].clone();
	ReductionManager.prepareReduction(body);
	
	app.replaceBy(body);
	
	//ReductionManager.setInError(body, "debug");
	//throw new ReductionError();
	
	/*
	let result;
	let symbol;
	if (parameters.children.length > 0) {
		let parameter, value;
		result = Formulae.createExpression("Programming.Block");
		
		for (let i = 0, n = values.children.length; i < n; ++i) {
			parameter = parameters.children[i];
			if (parameter.getTag() !== "Symbolic.Symbol") {
				ReductionManager.setInError(parameter, "Expression must be a symbol");
				throw new ReductionError();
			}
			
			symbol = parameter.get("Name");
			let newSymbol = Symbolic.FULL_SUBSTITUTION ? symbol + "_" + Symbolic.getNextIdentifier() : symbol + "_";
			
			parameter = parameter.clone();
			parameter.set("Name", newSymbol);
			value = values.children[i].clone();
			
			let assignment = Formulae.createExpression("Symbolic.Assignment");
			assignment.addChild(parameter);
			assignment.addChild(value);
			
			let local = Formulae.createExpression("Symbolic.Local");
			local.addChild(assignment);
			
			result.addChild(local);
			
			Symbolic.replaceSymbol(body, symbol, newSymbol);
		}
		
		result.addChild(body);
	}
	else {
		result = body;
	}
		
	if (values.children.length == parameters.children.length) { // total application
		app.replaceBy(result);
	}
	else { // partial application
		for (let i = 0, n = values.children.length; i < n; ++i) {
			parameters.removeChildAt(0);
		}
		lambda.setChild(1, result);
		app.replaceBy(lambda);
	}
	*/
	
	//////////////////////////////////////////
	
	let symbol;
	for (let i = 0, n = parameters.children.length; i < n; ++i) {
		symbol = parameters.children[i];
		if (symbol.getTag() !== "Symbolic.Symbol") {
			ReductionManager.setInError(symbol, "Expression must be a symbol");
			throw new ReductionError();
		}
		
		Symbolic.replaceSymbol(body, symbol.get("Name"), values.children[i]);
	}
	
	//////////////////////////////////////////
	
	//ReductionManager.setInError(body, "debug");
	//throw new ReductionError();
	
	try {
		//await session.reduce(result);
		await session.reduce(body);
	}
	catch (error) {
		if (error instanceof Symbolic.ReturnError) {
			result.replaceBy(error.cause);
		}
		else {
			throw error;
		}
	}
	
	return true;
}

// Lambda builder

Symbolic.lambdaBuilderReducer = async (lambdaCreation, session) => {
	let args = lambdaCreation.children[0];
	if (args.getTag() !== "List.List") {
		ReductionManager.setInError(args, "Expression must be a list");
		throw new ReductionError();
	}
	
	let last = "";
	let arg;
	
	for (let i = 0, n = args.children.length; i < n; ++i) {
		arg = args.children[i];
		
		if (arg.getTag() !== "Symbolic.Symbol") {
			ReductionManager.setInError(arg, "Expression must be a symbol");
			throw new ReductionError();
		}
		if ((arg.get("Name")) === last) {
			ReductionManager.setInError(arg, "Duplicated symbol");
			throw new ReductionError();
		}
		last = arg.get("Name");
	}
	
	let lambda = Formulae.createExpression("Symbolic.Lambda");
	lambda.addChild(args);
	lambda.addChild(lambdaCreation.children[1]);
	
	lambdaCreation.replaceBy(lambda);
	//session.log("Lambda creation");
	
	return true;
};
	
// Assignment pitfall reducer
// Assignment(e1, e2)[low]
// It must be low precedence to be a pitfall for no valid forms of assignment
	
Symbolic.assignmentPitfallReducer = async (assignmentExpression, session) => {
	ReductionManager.setInError(assignmentExpression, "Invalid assignment");
	throw new ReductionError();
};

Symbolic.comparison = async (comparison, session) => {
	if (
		comparison.children[0].getTag() !== "Symbolic.Symbol" ||
		comparison.children[1].getTag() !== "Symbolic.Symbol"
	) {
		return false;
	}
	
	if (
		comparison.children[0].getTag() === "Symbolic.Symbol" &&
		comparison.children[1].getTag() === "Symbolic.Symbol" &&
		comparison.children[0].get("Name") === comparison.children[1].get("Name")
	) {
		comparison.replaceBy(Formulae.createExpression("Relation.Comparison.Equals"));
	}
	
	return true;
};

Symbolic.setReducers = () => {
	ReductionManager.addReducer("Symbolic.Symbol",            Symbolic.symbolReducer,                 "Symbolic.symbolReducer");
	ReductionManager.addReducer("Symbolic.Assignment",        Symbolic.assignmentSymbolReducer,       "Symbolic.assignmentSymbolReducer", { special: true });
	ReductionManager.addReducer("Symbolic.Assignment",        Symbolic.assignmentListReducer,         "Symbolic.assignmentListReducer", { special: true });
	ReductionManager.addReducer("Expression.Child",           Symbolic.childSymbolReducer,            "Symbolic.childSymbolReducer", { special: true });
	ReductionManager.addReducer("Symbolic.Assignment",        Symbolic.assignmentChildSymbolReducer,  "Symbolic.assignmentChildSymbolReducer", { special: true });
	ReductionManager.addReducer("Symbolic.Function",          Symbolic.functionReducer,               "Symbolic.functionReducer");
	ReductionManager.addReducer("Symbolic.Assignment",        Symbolic.assignmentFunctionReducer,     "Symbolic.assignmentFunctionReducer", { special: true });
	ReductionManager.addReducer("Symbolic.Local",             Symbolic.localArrayReducer,             "Symbolic.localArrayReducer", { special: true });
	ReductionManager.addReducer("Symbolic.Local",             Symbolic.localReducer,                  "Symbolic.localReducer");
	ReductionManager.addReducer("Symbolic.Undefine",          Symbolic.undefineReducer,               "Symbolic.undefineReducer", { special: true });
	ReductionManager.addReducer("Expression.Cardinality",     Symbolic.cardinalitySymbolReducer,      "Symbolic.cardinalitySymbolReducer", { special: true });
	ReductionManager.addReducer("Expression.Cardinality",     Symbolic.cardinalityChildSymbolReducer, "Symbolic.cardinalityChildSymbolReducer", { special: true });
	ReductionManager.addReducer("Symbolic.Return",            Symbolic.returnReducer,                 "Symbolic.returnReducer");
	ReductionManager.addReducer("Expression.Append",          Symbolic.appendSymbolReducer,           "Symbolic.appendSymbolReducer", { special: true, precedence: ReductionManager.PRECEDENCE_HIGH });
	ReductionManager.addReducer("Expression.Prepend",         Symbolic.prependSymbolReducer,          "Symbolic.prependSymbolReducer", { special: true, precedence: ReductionManager.PRECEDENCE_HIGH });
	ReductionManager.addReducer("Expression.Insert",          Symbolic.insertSymbolReducer,           "Symbolic.insertSymbolReducer", { special: true, precedence: ReductionManager.PRECEDENCE_HIGH });
	ReductionManager.addReducer("Expression.Delete",          Symbolic.deleteSymbolReducer,           "Symbolic.deleteSymbolReducer", { special: true, precedence: ReductionManager.PRECEDENCE_HIGH });
	ReductionManager.addReducer("Symbolic.Lambda",            Symbolic.lambdaReducer,                 "Symbolic.lambdaReducer", { special: true });
	ReductionManager.addReducer("Symbolic.LambdaApplication", Symbolic.lambdaApplication,             "Symbolic.lambdaApplication", { special: true }); // TEST
	ReductionManager.addReducer("Symbolic.LambdaBuilder",     Symbolic.lambdaBuilderReducer,          "Symbolic.lambdaBuilderReducer");
	ReductionManager.addReducer("Symbolic.Assignment",        Symbolic.assignmentPitfallReducer,      "Symbolic.assignmentPitfallReducer", { precedence: ReductionManager.PRECEDENCE_LOW });
	ReductionManager.addReducer("Relation.Compare",           Symbolic.comparison,                    "Symbolic.comparison");

};

